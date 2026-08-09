# ADR 0001: Banco de Dados Gerenciado Fora do Cluster Kubernetes

- **Status:** Aprovado
- **Data:** 2026-08-05

## Contexto

A API de Pedidos ([app/main.py](../../app/main.py)) exige persistência relacional para pedidos e itens ([app/models.py](../../app/models.py)), com necessidade de backups, alta confiabilidade e resiliência a falhas de pods. Era preciso decidir entre rodar o PostgreSQL como um Pod/StatefulSet dentro do cluster Kubernetes da Magalu Cloud ou consumi-lo como um serviço gerenciado (DBaaS) externo ao cluster.

Os manifestos em `k8s/` ([app.yaml](../../k8s/app.yaml)) não definem nenhum StatefulSet, PersistentVolumeClaim ou Service de banco de dados — a aplicação recebe a string de conexão exclusivamente via variável de ambiente `DATABASE_URL`, populada a partir do Secret `db-secret`, criado pelo workflow de deploy ([deploy.yml](../../.github/workflows/deploy.yml)) a partir do secret do GitHub `DATABASE_URL`. Em ambiente local, o `docker-compose.yml` sobe um container `postgres:16` apenas para desenvolvimento, sem refletir a topologia de produção.

## Decisão

Decidimos utilizar um PostgreSQL gerenciado (DBaaS), externo ao cluster Kubernetes, como banco de dados de produção da aplicação. O cluster nunca gerencia o ciclo de vida do banco — apenas consome sua string de conexão via Secret.

## Consequências

- **Positivas:**
  - Elimina a complexidade de gerenciar volumes persistentes, backups e failover de um StatefulSet dentro do cluster.
  - Backups automatizados e alta disponibilidade ficam sob responsabilidade do provedor gerenciado, contribuindo diretamente para o SLA de 99.9% definido em [docs/architecture.md](../architecture.md).
  - Desacopla o ciclo de vida do banco do ciclo de vida do cluster: é possível recriar, escalar ou até trocar o cluster Kubernetes sem risco de perda de dados.
  - Simplifica o Deployment da aplicação, que passa a ser stateless e trivialmente escalável horizontalmente pelo HPA ([k8s/hpa.yaml](../../k8s/hpa.yaml)).
- **Negativas:**
  - Custo direto e recorrente do serviço gerenciado, computado no teto de FinOps (R$ 150,00/mês).
  - Latência de rede adicional entre os pods e o banco, por não estarem na mesma rede interna do cluster (mitigado por estarem na mesma região `br-se1`).
  - Menor controle sobre versão, extensões e tunagem fina do PostgreSQL, que ficam limitados ao que o provedor gerenciado permite.
  - Cada réplica da aplicação abre seu próprio pool de conexões contra a mesma instância gerenciada — o `maxReplicas: 6` do HPA foi definido considerando esse limite de conexões simultâneas.
