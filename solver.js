/**
 * Bounded-PCP Solver Engine (solver.js)
 * Motor matemático e algoritmo de busca BFS para o Problema da Correspondência de Post Limitado.
 */

// Estrutura de Nó da Busca BFS
class PCPNode {
  /**
   * @param {number[]} sequence - Lista de IDs ou índices dos dominós usados
   * @param {string} topStr - Concatenação acumulada do Topo
   * @param {string} bottomStr - Concatenação acumulada da Base
   */
  constructor(sequence, topStr, bottomStr) {
    this.sequence = sequence;
    this.topStr = topStr;
    this.bottomStr = bottomStr;
    this.depth = sequence.length;

    // Determina o excesso (remainder) e qual fita está adiantada
    if (topStr.length === bottomStr.length) {
      this.remainderType = 'match';
      this.remainder = '';
    } else if (topStr.length > bottomStr.length) {
      this.remainderType = 'top';
      this.remainder = topStr.slice(bottomStr.length);
    } else {
      this.remainderType = 'bottom';
      this.remainder = bottomStr.slice(topStr.length);
    }
  }

  /**
   * Chave de estado para detecção de ciclos / redundâncias
   * @returns {string}
   */
  getStateKey() {
    return `${this.remainderType}:${this.remainder}`;
  }

  /**
   * Verifica se o nó representa uma solução válida completa
   * @returns {boolean}
   */
  isMatch() {
    return this.depth > 0 && this.topStr.length === this.bottomStr.length && this.topStr === this.bottomStr;
  }
}

/**
 * Função pura de resolução BFS do Bounded-PCP
 * @param {Array<{id: number, top: string, bottom: string}>} dominoes - Conjunto de dominós
 * @param {number} maxK - Limite máximo de dominós na sequência
 * @param {function} [onProgress] - Callback opcional para relatar progresso periódico
 * @returns {object} Resultado contendo solução e estatísticas
 */
function solvePCP(dominoes, maxK, onProgress = null) {
  const startTime = performance.now();

  const stats = {
    nodesExplored: 0,
    nodesPrunedPrefix: 0,
    nodesPrunedCycle: 0,
    nodesPrunedDepth: 0,
    maxDepthReached: 0,
    totalCreated: 0,
    executionTimeMs: 0,
    solution: null, // { sequence, string, dominoes }
    hasSolution: false
  };

  if (!dominoes || dominoes.length === 0 || maxK < 1) {
    stats.executionTimeMs = performance.now() - startTime;
    return stats;
  }

  // Mapeamento rápido por ID
  const dominoMap = new Map();
  dominoes.forEach(d => dominoMap.set(d.id, d));

  // 1. Inicialização da fila apenas com dominós com compatibilidade inicial (Poda de Raiz)
  const queue = [];
  const visitedStates = new Set();

  for (const d of dominoes) {
    // Para ser o primeiro dominó, top deve ser prefixo de bottom OU bottom de top
    if (d.top.startsWith(d.bottom) || d.bottom.startsWith(d.top)) {
      const initialNode = new PCPNode([d.id], d.top, d.bottom);
      stats.totalCreated++;

      // Caso trivial: um único dominó já forma correspondência perfeita (ex: [ab/ab])
      if (initialNode.isMatch()) {
        stats.nodesExplored = 1;
        stats.solution = {
          sequence: [d.id],
          string: d.top,
          dominoes: [d]
        };
        stats.hasSolution = true;
        stats.executionTimeMs = performance.now() - startTime;
        return stats;
      }

      visitedStates.add(initialNode.getStateKey());
      queue.push(initialNode);
    } else {
      stats.nodesPrunedPrefix++;
    }
  }

  let lastProgressReport = startTime;

  // 2. Loop de Busca em Largura (BFS)
  while (queue.length > 0) {
    const currentNode = queue.shift();
    stats.nodesExplored++;
    if (currentNode.depth > stats.maxDepthReached) {
      stats.maxDepthReached = currentNode.depth;
    }

    // Relatório periódico de progresso (a cada ~100ms se callback fornecido)
    if (onProgress && performance.now() - lastProgressReport > 100) {
      lastProgressReport = performance.now();
      onProgress({
        nodesExplored: stats.nodesExplored,
        nodesPruned: stats.nodesPrunedPrefix + stats.nodesPrunedCycle + stats.nodesPrunedDepth,
        queueSize: queue.length,
        currentDepth: currentNode.depth,
        elapsedMs: Math.round(performance.now() - startTime)
      });
    }

    // Se já atingiu o limite K, não expande filhos
    if (currentNode.depth >= maxK) {
      stats.nodesPrunedDepth++;
      continue;
    }

    // 3. Tenta concatenar cada dominó disponível
    for (const d of dominoes) {
      const nextTop = currentNode.topStr + d.top;
      const nextBottom = currentNode.bottomStr + d.bottom;

      // Poda por Prefixo: a concatenação resultante DEVE manter relação de prefixo
      if (!nextTop.startsWith(nextBottom) && !nextBottom.startsWith(nextTop)) {
        stats.nodesPrunedPrefix++;
        continue;
      }

      const nextSequence = [...currentNode.sequence, d.id];
      const nextNode = new PCPNode(nextSequence, nextTop, nextBottom);
      stats.totalCreated++;

      // Verificação de Sucesso!
      if (nextNode.isMatch()) {
        stats.nodesExplored++;
        stats.solution = {
          sequence: nextSequence,
          string: nextTop,
          dominoes: nextSequence.map(id => dominoMap.get(id))
        };
        stats.hasSolution = true;
        stats.executionTimeMs = performance.now() - startTime;
        return stats;
      }

      // Poda de Estados Cíclicos / Redundantes de Cauda
      const stateKey = nextNode.getStateKey();
      if (visitedStates.has(stateKey)) {
        stats.nodesPrunedCycle++;
        continue;
      }

      visitedStates.add(stateKey);
      queue.push(nextNode);
    }
  }

  stats.executionTimeMs = performance.now() - startTime;
  return stats;
}

/**
 * Gerador Assíncrono para o Modo Didático Passo a Passo
 * Produz yields detalhados a cada expansão para permitir visualização frame a frame
 * @param {Array<{id: number, top: string, bottom: string}>} dominoes
 * @param {number} maxK
 */
async function* solvePCPStepByStep(dominoes, maxK) {
  const startTime = performance.now();
  const dominoMap = new Map();
  dominoes.forEach(d => dominoMap.set(d.id, d));

  const stats = {
    nodesExplored: 0,
    nodesPrunedPrefix: 0,
    nodesPrunedCycle: 0,
    nodesPrunedDepth: 0,
    maxDepthReached: 0,
    queueSize: 0
  };

  const queue = [];
  const visitedStates = new Set();

  yield {
    type: 'START',
    message: `Iniciando BFS com ${dominoes.length} dominós e limite K=${maxK}`,
    stats: { ...stats }
  };

  // 1. Raízes
  for (const d of dominoes) {
    const isPrefixCompatible = d.top.startsWith(d.bottom) || d.bottom.startsWith(d.top);
    yield {
      type: 'EVALUATING_INITIAL',
      domino: d,
      compatible: isPrefixCompatible,
      reason: isPrefixCompatible ? 'Compatível como peça inicial (prefixo válido)' : 'Descartado: Topo e Base não têm prefixo comum'
    };

    if (isPrefixCompatible) {
      const node = new PCPNode([d.id], d.top, d.bottom);
      if (node.isMatch()) {
        stats.nodesExplored = 1;
        yield {
          type: 'SOLUTION_FOUND',
          node,
          solution: {
            sequence: [d.id],
            string: d.top,
            dominoes: [d]
          },
          stats: { ...stats, executionTimeMs: performance.now() - startTime }
        };
        return;
      }
      visitedStates.add(node.getStateKey());
      queue.push(node);
    } else {
      stats.nodesPrunedPrefix++;
    }
  }

  // 2. Loop BFS com yield a cada nó e candidato
  while (queue.length > 0) {
    const currentNode = queue.shift();
    stats.nodesExplored++;
    stats.queueSize = queue.length;
    stats.maxDepthReached = Math.max(stats.maxDepthReached, currentNode.depth);

    yield {
      type: 'EXPANDING_NODE',
      node: currentNode,
      stats: { ...stats }
    };

    if (currentNode.depth >= maxK) {
      stats.nodesPrunedDepth++;
      yield {
        type: 'PRUNED_DEPTH',
        node: currentNode,
        reason: `Profundidade limite atingida (${currentNode.depth} >= ${maxK}). Não gera filhos.`
      };
      continue;
    }

    for (const d of dominoes) {
      const nextTop = currentNode.topStr + d.top;
      const nextBottom = currentNode.bottomStr + d.bottom;

      // Poda por Prefixo
      if (!nextTop.startsWith(nextBottom) && !nextBottom.startsWith(nextTop)) {
        stats.nodesPrunedPrefix++;
        yield {
          type: 'CANDIDATE_REJECTED_PREFIX',
          parentNode: currentNode,
          domino: d,
          nextTop,
          nextBottom,
          reason: `Divergência de caracteres entre topo ("${nextTop}") e base ("${nextBottom}")`
        };
        continue;
      }

      const nextSequence = [...currentNode.sequence, d.id];
      const nextNode = new PCPNode(nextSequence, nextTop, nextBottom);

      // Verificação de Sucesso
      if (nextNode.isMatch()) {
        stats.nodesExplored++;
        yield {
          type: 'SOLUTION_FOUND',
          node: nextNode,
          solution: {
            sequence: nextSequence,
            string: nextTop,
            dominoes: nextSequence.map(id => dominoMap.get(id))
          },
          stats: { ...stats, executionTimeMs: performance.now() - startTime }
        };
        return;
      }

      // Poda de Ciclos
      const stateKey = nextNode.getStateKey();
      if (visitedStates.has(stateKey)) {
        stats.nodesPrunedCycle++;
        yield {
          type: 'CANDIDATE_REJECTED_CYCLE',
          parentNode: currentNode,
          domino: d,
          stateKey,
          reason: `Estado de cauda ("${stateKey}") já explorado em profundidade menor ou igual`
        };
        continue;
      }

      visitedStates.add(stateKey);
      queue.push(nextNode);

      yield {
        type: 'CANDIDATE_ACCEPTED',
        parentNode: currentNode,
        domino: d,
        nextNode,
        queueSize: queue.length
      };
    }
  }

  yield {
    type: 'NO_SOLUTION',
    stats: { ...stats, executionTimeMs: performance.now() - startTime },
    message: `Nenhuma solução encontrada com comprimento <= ${maxK}. Espaço de busca esgotado.`
  };
}

/**
 * Criação do código do Web Worker embutido via Blob
 * Isso contorna qualquer restrição de CORS em ambientes locais (file://) ou GitHub Pages.
 */
function createPCPWorker() {
  const workerCode = `
    ${PCPNode.toString()}
    ${solvePCP.toString()}

    self.onmessage = function(e) {
      const { dominoes, maxK } = e.data;
      const result = solvePCP(dominoes, maxK, (progress) => {
        self.postMessage({ type: 'PROGRESS', data: progress });
      });
      self.postMessage({ type: 'COMPLETE', data: result });
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

// Exportação compatível com ambientes de módulo e script direto no navegador
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PCPNode, solvePCP, solvePCPStepByStep, createPCPWorker };
}
