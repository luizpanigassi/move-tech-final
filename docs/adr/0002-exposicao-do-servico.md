# ADR 0002: Estratégia de Exposição do Serviço (LoadBalancer)

- **Status:** Aprovado
- **Data:** 2026-08-05

## Contexto

A API de Pedidos precisa ser acessível publicamente — tanto por clientes reais quanto pelo workflow de teste de carga k6 ([load-test.yml](../../.github/workflows/load-test.yml)), que recebe como parâmetro obrigatório a `base_url` pública da aplicação. Havia duas estratégias principais de roteamento de tráfego externo no Kubernetes a considerar: expor a aplicação diretamente via `Service` do tipo `LoadBalancer` (provisionando um balanceador de carga nativo da nuvem por serviço) ou introduzir um `Ingress Controller` (ex.: Nginx) como camada única de entrada e roteamento por host/path para múltiplos serviços.

O manifesto [k8s/app.yaml](../../k8s/app.yaml) define o `Service cloud-application` com `type: LoadBalancer`, mapeando a porta 80 externa para a porta 8000 dos pods (`targetPort: 8000`), sem nenhum recurso `Ingress` presente no repositório.

## Decisão

Decidimos expor a aplicação diretamente por meio de um `Service` Kubernetes do tipo `LoadBalancer`, provisionado pela Magalu Cloud, em vez de introduzir um Ingress Controller.

## Consequências

- **Positivas:**
  - Simplicidade operacional: não é necessário instalar, configurar ou manter um Ingress Controller (ex.: Nginx) nem seus respectivos recursos (`Ingress`, `IngressClass`, certificados de TLS por host).
  - Provisionamento automático de um IP público pela nuvem, exposto de forma previsível e compatível com o parâmetro `base_url` exigido pelo teste de carga k6.
  - Menor superfície de configuração para um cenário de solução única (um único serviço HTTP a expor), reduzindo pontos de falha.
- **Negativas:**
  - Cada `Service LoadBalancer` provisiona um balanceador de carga dedicado na nuvem, o que tem custo direto por serviço exposto — não escala bem em custo caso a solução evolua para múltiplos serviços/microsserviços expostos publicamente.
  - Ausência de recursos típicos de um Ingress, como roteamento por host/path, TLS termination centralizado e regras de reescrita de URL — caso a aplicação precise expor múltiplos serviços sob um único domínio, será necessário reavaliar essa decisão.
  - Sem um Ingress Controller, funcionalidades comuns de borda (rate limiting, WAF, redirecionamento HTTP→HTTPS) precisariam ser implementadas na própria aplicação ou em outra camada.
