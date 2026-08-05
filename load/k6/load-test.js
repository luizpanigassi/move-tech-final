import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// Parâmetros vêm do workflow (-e CHAVE=valor). Nada de hardcode de IP.
const BASE = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '2m';
const RAMP = __ENV.RAMP || '30s';
const P95_ALVO = Number(__ENV.P95_ALVO_MS || 500);

// Latência por rota — o P95 agregado esconde qual endpoint dói.
const criarPedido = new Trend('latencia_post_orders', true);
const listarPedidos = new Trend('latencia_get_orders', true);
const consultarPedido = new Trend('latencia_get_pedido', true);

export const options = {
  stages: [
    { duration: RAMP, target: VUS },      // rampa
    { duration: DURATION, target: VUS },  // patamar: é aqui que se lê o Grafana
    { duration: '20s', target: 0 },       // descida
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],                 // menos de 1% de erro
    http_req_duration: [`p(95)<${P95_ALVO}`],       // SLO do docs/architecture.md
    latencia_post_orders: [`p(95)<${P95_ALVO}`],
    latencia_get_orders: [`p(95)<${P95_ALVO}`],
  },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

// Roda uma vez, antes da carga: falha cedo e com mensagem clara.
export function setup() {
  const res = http.get(`${BASE}/health`, { timeout: '10s' });
  if (res.status !== 200) {
    throw new Error(`${BASE}/health respondeu ${res.status} — confira o EXTERNAL-IP e o Security Group`);
  }
  if (res.json('database') !== 'ok') {
    throw new Error('a aplicação respondeu, mas o banco está indisponível (/health: database != ok)');
  }
}

export default function () {
  let pedidoId = null;

  group('criar pedido', () => {
    const res = http.post(
      `${BASE}/orders`,
      JSON.stringify({ customer: `k6-vu-${__VU}` }),
      { ...JSON_HEADERS, tags: { rota: 'POST /orders' } },
    );
    criarPedido.add(res.timings.duration);
    const ok = check(res, {
      'POST /orders => 201': (r) => r.status === 201,
      'devolve id do pedido': (r) => !!r.json('id'),
    });
    if (ok) pedidoId = res.json('id');
  });

  if (pedidoId) {
    group('adicionar item', () => {
      const item = { sku: `SKU-${__ITER}`, description: 'Item de teste', quantity: 2 };
      const res = http.post(
        `${BASE}/orders/${pedidoId}/items`,
        JSON.stringify(item),
        { ...JSON_HEADERS, tags: { rota: 'POST /orders/{id}/items' } },
      );
      check(res, { 'POST /orders/{id}/items => 201': (r) => r.status === 201 });
    });

    group('consultar pedido', () => {
      const res = http.get(`${BASE}/orders/${pedidoId}`, { tags: { rota: 'GET /orders/{id}' } });
      consultarPedido.add(res.timings.duration);
      check(res, { 'GET /orders/{id} => 200': (r) => r.status === 200 });
    });
  }

  group('listar pedidos', () => {
    // Rota mais pesada: carrega todos os pedidos e serializa todos os itens.
    const res = http.get(`${BASE}/orders`, { tags: { rota: 'GET /orders' } });
    listarPedidos.add(res.timings.duration);
    check(res, { 'GET /orders => 200': (r) => r.status === 200 });
  });

  sleep(1);
}

// Resumo em Markdown para o GitHub Step Summary, além do resumo normal no console.
export function handleSummary(data) {
  const m = data.metrics;
  const v = (metric, stat, casas = 0) =>
    metric && metric.values[stat] !== undefined ? metric.values[stat].toFixed(casas) : '—';

  const linhas = [
    ['**Total**', m.http_req_duration],
    ['`POST /orders`', m.latencia_post_orders],
    ['`GET /orders`', m.latencia_get_orders],
    ['`GET /orders/{id}`', m.latencia_get_pedido],
  ]
    .map(([nome, metric]) =>
      `| ${nome} | ${v(metric, 'avg')} | ${v(metric, 'p(95)')} | ${v(metric, 'p(99)')} | ${v(metric, 'max')} |`)
    .join('\n');

  const violados = Object.entries(data.thresholds || {})
    .filter(([, t]) => !t.ok)
    .map(([nome]) => `- \`${nome}\``);

  const markdown = `## Teste de carga · k6

**Alvo:** \`${BASE}\` · **VUs:** ${VUS} · **patamar:** ${DURATION} · **SLO P95:** ${P95_ALVO} ms

| Indicador | Valor |
| --- | ---: |
| Requisições | ${v(m.http_reqs, 'count')} |
| Throughput | ${v(m.http_reqs, 'rate', 1)} req/s |
| Taxa de erro | ${m.http_req_failed ? (m.http_req_failed.values.rate * 100).toFixed(2) : '—'}% |

| Latência (ms) | Média | P95 | P99 | Máx |
| --- | ---: | ---: | ---: | ---: |
${linhas}

${violados.length ? `### ⚠️ Thresholds violados\n${violados.join('\n')}` : '### ✅ Todos os thresholds passaram'}

> Leia junto com o Grafana: se o P95 subiu e a CPU dos pods não acompanhou, o gargalo não está no pod.
`;

  return {
    stdout: '\n' + markdown + '\n',
    'resumo.md': markdown,
    'resultado.json': JSON.stringify(data, null, 2),
  };
}