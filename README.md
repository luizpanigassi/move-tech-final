# move-tech-cloud-application-comp-6

Ponto de partida da **Competência 6 — Arquitetura de Soluções em Nuvem**.

Este repositório é um template. Use-o como base para criar o seu próprio repositório e trabalhar na competência.

> Parte do curso **Move Tech** — Magalu × Prósper Digital Skills  
> Formação em Cloud Computing para iniciantes

---

## Etapas anteriores

> [move-tech-cloud-application-comp-3](https://github.com/move-tech-cloud-computing/move-tech-cloud-application-comp-3) · [move-tech-cloud-application-comp-4](https://github.com/move-tech-cloud-computing/move-tech-cloud-application-comp-4) · [move-tech-cloud-application-comp-5](https://github.com/move-tech-cloud-computing/move-tech-cloud-application-comp-5)

---

## O que você vai fazer nesta competência

Ao final da Competência 6, você terá **documentado e analisado a arquitetura** da solução que construiu.

- [ ] Desenhar o diagrama de arquitetura da solução na Magalu Cloud
- [ ] Documentar as decisões técnicas tomadas ao longo do curso (ADR)
- [ ] Analisar os trade-offs das escolhas: custo, escalabilidade, disponibilidade
- [ ] Identificar pontos de melhoria e próximos passos

---

## Como rodar localmente

**Pré-requisito:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado (Mac e Windows) ou [Docker Engine](https://docs.docker.com/engine/install/) (Linux).

```bash
docker compose up --build
```

Acesse a documentação interativa em: http://localhost:8000/docs

---

## Secrets necessários no GitHub

| Secret | Descrição |
|--------|-----------|
| `MGC_REGISTRY_USER` | Usuário do Container Registry da MGC |
| `MGC_REGISTRY_PASSWORD` | Senha do Container Registry da MGC |
| `MGC_REGISTRY_NAME` | Nome do seu registry na MGC |
| `MGC_KUBECONFIG` | Conteúdo do arquivo `kubeconfig.yaml` (cole o conteúdo diretamente) |
| `DATABASE_URL` | String de conexão do PostgreSQL (`postgresql://user:pass@host/orders`) |
---

## Deploy e observabilidade

O workflow `Deploy` publica a imagem no Container Registry e aplica os manifestos em `k8s/`:

- `app.yaml`: Deployment com duas réplicas, probes de saúde (`/health`), recursos de CPU/memória e Service do tipo `LoadBalancer`;
- `hpa.yaml`: HPA baseado em utilização de CPU, mantendo entre 2 e 6 réplicas;
- `servicemonitor.yaml`: ServiceMonitor que coleta as métricas da aplicação em `/metrics` a cada 15 segundos.

O HPA requer que o cluster tenha o Metrics Server instalado. O ServiceMonitor requer o Prometheus Operator e utiliza o label `release: monitoring`; ajuste esse valor caso o nome da instalação do Prometheus no cluster seja diferente.

O endpoint `/metrics` é disponibilizado pelo `prometheus-fastapi-instrumentator`. O `Service` possui o label `app: cloud-application`, usado pelo ServiceMonitor para localizar os pods da aplicação.

## Teste de carga com k6

O workflow manual `Teste de carga (k6)` executa `load/k6/load-test.js` contra a aplicação implantada. Para executá-lo:

1. Acesse **Actions > Teste de carga (k6) > Run workflow**.
2. Informe a URL pública do Service (`base_url`), a quantidade de usuários virtuais (`vus`), a duração do patamar (`duration`), o tempo de rampa (`ramp`) e o SLO de P95 (`p95_alvo_ms`).
3. Consulte o resumo gerado no GitHub Actions e os artefatos `resumo.md` e `resultado.json`.

O teste valida o health check, criação e consulta de pedidos, inclusão de itens, listagem de pedidos, taxa de erros e latência P95. Os valores padrão são 20 VUs, 2 minutos de carga, rampa de 30 segundos e P95 máximo de 500 ms.

## Solução completa de referência

Ao concluir esta competência, a solução final de referência estará disponível em:  
[move-tech-cloud-application-final](https://github.com/move-tech-cloud-computing/move-tech-cloud-application-final)
