# ADR 0003: Granularidade da Aplicação (Monolito Modular vs. Microsserviços)

- **Status:** Aprovado
- **Data:** 2026-08-05

## Contexto

O domínio da solução — gestão de pedidos e itens de pedido ([app/models.py](../../app/models.py)) — poderia, em tese, ser dividido em serviços independentes (ex.: um serviço de "Pedidos" e outro de "Itens", ou serviços separados por bounded context). Era preciso decidir a granularidade da aplicação: um monolito modular único ou uma decomposição em múltiplos microsserviços implantados e escalados de forma independente.

O código-fonte em [app/main.py](../../app/main.py) implementa todas as rotas (health, stats, pedidos e itens) em um único processo FastAPI, com um único modelo de dados compartilhado (`Order` e `Item` na mesma base, relacionados por chave estrangeira) e uma única imagem de contêiner ([Dockerfile](../../Dockerfile)). O deployment em [k8s/app.yaml](../../k8s/app.yaml) define um único `Deployment`/`Service`, escalado horizontalmente como uma unidade só pelo HPA ([k8s/hpa.yaml](../../k8s/hpa.yaml)).

## Decisão

Decidimos manter a aplicação como um Monolito Modular: um único processo/contêiner FastAPI, organizado internamente em módulos (rotas, modelos, acesso a dados), implantado e escalado como uma única unidade no Kubernetes.

## Consequências

- **Positivas:**
  - Simplicidade de desenvolvimento, deploy e depuração: um único pipeline de CI/CD ([deploy.yml](../../.github/workflows/deploy.yml)), uma única imagem publicada no Container Registry, um único Deployment a monitorar.
  - Menor overhead operacional para a escala atual do domínio (pedidos e itens são fortemente acoplados e transacionais — um item sempre pertence a um pedido, com cascade de exclusão definido no próprio modelo).
  - Escalonamento horizontal via HPA já atende ao requisito de vazão (RPS) e disponibilidade sem a complexidade de orquestrar múltiplos serviços, filas de mensageria e contratos de API entre eles.
  - Transações de banco simples (uma única conexão/sessão SQLAlchemy por requisição) sem necessidade de coordenação distribuída entre serviços.
- **Negativas:**
  - Todo o sistema escala e é implantado como uma unidade só: não é possível escalar "itens" e "pedidos" de forma independente caso um dos domínios cresça desproporcionalmente.
  - Uma falha ou bug em qualquer rota do monolito pode impactar a disponibilidade de todas as demais funcionalidades, já que compartilham o mesmo processo.
  - Caso o domínio cresça significativamente em complexidade e times distintos passem a trabalhar nele, a ausência de fronteiras de serviço bem definidas pode dificultar a evolução futura para microsserviços.
