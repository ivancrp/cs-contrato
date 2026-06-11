# Estratégia de Otimização — Trade Up Contracts

## Problema

Selecionar 10 skins de entrada (com repetição permitida) de um pool de candidatos para maximizar uma função objetivo multi-critério:

- Menor custo total
- Maior EV (Expected Value)
- Maior chance da skin alvo
- Menor risco (variância + probabilidade de perda)
- Float de saída dentro do wear desejado

**Espaço de busca:** C(n+9, 9) combinações com repetição. Para n=50 candidatos ≈ 2.1×10¹¹ combinações.

## Algoritmos Escolhidos

### 1. Branch and Bound (n ≤ 25 candidatos únicos)

**Por quê:** Garante solução ótima ou near-optimal com poda agressiva por orçamento e bound superior de EV. Viável quando o pool é pequeno.

**Poda:**
- Custo parcial > orçamento → descarta
- Bound otimista (melhor EV possível com slots restantes) < melhor solução atual → descarta

### 2. Simulated Annealing (25 < n ≤ 80)

**Por quê:** Boa exploração do espaço com custo O(iterações). Aceita soluções piores temporariamente para escapar de mínimos locais. Ideal para pools médios.

**Parâmetros:** T₀=100, cooling=0.995, 5000 iterações

### 3. Algoritmo Genético (n > 80)

**Por quê:** Escala para milhões de combinações via população de 100 indivíduos × 200 gerações. Crossover e mutação preservam diversidade.

### 4. Heurística Greedy (semente inicial)

**Por quê:** Gera soluções iniciais rápidas para os 3 tiers ($, $$, $$$) e alimenta meta-heurísticas.

### 5. Monte Carlo (somente simulação)

**Por quê:** Valida distribuição estatística real com 100.000 iterações. Não otimiza, apenas simula resultados.

## Seleção Automática

```
if candidates ≤ 25  → Branch and Bound
if candidates ≤ 80  → Simulated Annealing  
else                → Genetic Algorithm
```

## Função Objetivo (Score)

```
score = w₁×norm(EV) + w₂×norm(chance) - w₃×norm(custo) - w₄×norm(risco) - w₅×norm(perda)
```

Pesos variam por modo:
- **low_cost:** w₃=0.4, w₁=0.2, w₂=0.2
- **balanced:** pesos iguais
- **high_chance:** w₂=0.4, w₁=0.3
- **min_loss:** w₅=0.4, w₄=0.3
