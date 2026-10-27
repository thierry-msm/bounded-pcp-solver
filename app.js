/**
 * Bounded-PCP Interactive Application Controller (app.js)
 * Gerenciador de estado, eventos de UI, renderizador de dominós e fitas duplas.
 */

// ============================================================================
// 1. PRESETS HISTÓRICOS E TEÓRICOS
// ============================================================================
const PRESETS = {
  sipser: {
    name: 'Sipser 5.15 (Clássico)',
    k: 7,
    dominoes: [
      { id: 1, top: 'b', bottom: 'ca' },
      { id: 2, top: 'a', bottom: 'ab' },
      { id: 3, top: 'ca', bottom: 'a' },
      { id: 4, top: 'abc', bottom: 'c' }
    ]
  },
  fast: {
    name: 'Solução Rápida (2 Peças)',
    k: 5,
    dominoes: [
      { id: 1, top: '01', bottom: '1' },
      { id: 2, top: '0', bottom: '00' }
    ]
  },
  trivial: {
    name: 'Match Imediato (1 Peça)',
    k: 5,
    dominoes: [
      { id: 1, top: 'abc', bottom: 'abc' },
      { id: 2, top: 'x', bottom: 'y' }
    ]
  },
  binary: {
    name: 'Desafio Binário {0, 1}',
    k: 8,
    dominoes: [
      { id: 1, top: '001', bottom: '0' },
      { id: 2, top: '01', bottom: '011' },
      { id: 3, top: '11', bottom: '101' }
    ]
  },
  impossible: {
    name: 'Sem Solução em K',
    k: 6,
    dominoes: [
      { id: 1, top: 'a', bottom: 'ba' },
      { id: 2, top: 'ab', bottom: 'b' }
    ]
  }
};

// ============================================================================
// 2. ESTADO GLOBAL DA APLICAÇÃO (APP STATE)
// ============================================================================
const state = {
  dominoes: JSON.parse(JSON.stringify(PRESETS.sipser.dominoes)),
  nextDominoId: 5,
  maxK: 7,
  conveyorSequence: [], // Array de IDs de dominós colocados na esteira manual
  
  // Estado do Solver Automático
  isSolving: false,
  activeWorker: null,
  
  // Estado do Modo Didático
  isDidacticMode: false,
  didacticRunning: false,
  didacticGenerator: null,
  didacticTimer: null,
  didacticSpeed: 300, // ms
  
  // Métricas
  metrics: {
    time: 0,
    explored: 0,
    prunedPrefix: 0,
    prunedCycle: 0,
    prunedDepth: 0,
    queue: 0
  }
};

// ============================================================================
// 3. INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromURL();
  initUIElements();
  renderDominoPalette();
  updateConveyorBelt();
  updateMetricsDisplay();
});

// ============================================================================
// 4. CONFIGURAÇÃO DE EVENTOS DA INTERFACE (UI EVENT LISTENERS)
// ============================================================================
function initUIElements() {
  // Controle de K (Slider e Input)
  const sliderK = document.getElementById('slider-max-k');
  const inputK = document.getElementById('input-max-k');
  const displayK = document.getElementById('display-max-k');

  function updateK(val) {
    const num = Math.min(25, Math.max(1, parseInt(val, 10) || 1));
    state.maxK = num;
    sliderK.value = Math.min(15, num);
    inputK.value = num;
    displayK.textContent = num;
    syncStateToURL();
  }

  sliderK.addEventListener('input', (e) => updateK(e.target.value));
  inputK.addEventListener('change', (e) => updateK(e.target.value));

  // Presets Selector (Header)
  const presetSelector = document.getElementById('preset-selector');
  presetSelector.addEventListener('change', (e) => {
    loadPreset(e.target.value);
    e.target.value = '';
  });

  // Presets dentro da Gaveta
  document.querySelectorAll('.btn-load-preset-drawer').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.preset;
      loadPreset(presetKey);
      closeDrawer();
    });
  });

  // Formulário de Adicionar Dominó
  const formAdd = document.getElementById('form-add-domino');
  formAdd.addEventListener('submit', (e) => {
    e.preventDefault();
    const topInput = document.getElementById('input-new-top');
    const bottomInput = document.getElementById('input-new-bottom');
    const topVal = topInput.value.trim().toLowerCase();
    const bottomVal = bottomInput.value.trim().toLowerCase();

    if (!topVal || !bottomVal) {
      showToast('Preencha os valores do Topo e da Base.', 'error');
      return;
    }

    const newDomino = {
      id: state.nextDominoId++,
      top: topVal,
      bottom: bottomVal
    };

    state.dominoes.push(newDomino);
    renderDominoPalette();
    syncStateToURL();
    showToast(`Dominó [${topVal}/${bottomVal}] adicionado com sucesso!`, 'success');

    topInput.value = '';
    bottomInput.value = '';
    topInput.focus();
  });

  // Limpar Dominós da Paleta
  document.getElementById('btn-clear-dominoes').addEventListener('click', () => {
    if (confirm('Deseja realmente limpar todos os dominós?')) {
      state.dominoes = [];
      state.conveyorSequence = [];
      renderDominoPalette();
      updateConveyorBelt();
      syncStateToURL();
      showToast('Paleta de dominós limpa.', 'info');
    }
  });

  // Controles da Esteira Manual
  document.getElementById('btn-undo-domino').addEventListener('click', undoConveyorDomino);
  document.getElementById('btn-clear-conveyor').addEventListener('click', clearConveyorBelt);

  // Botão Solver com Web Worker
  document.getElementById('btn-fast-solve').addEventListener('click', startWebWorkerSolve);

  // Modo Didático (Alternar e Controles)
  document.getElementById('btn-toggle-didactic').addEventListener('click', toggleDidacticMode);
  document.getElementById('btn-didactic-play').addEventListener('click', toggleDidacticPlay);
  document.getElementById('btn-didactic-step').addEventListener('click', stepDidactic);
  document.getElementById('btn-didactic-reset').addEventListener('click', resetDidactic);

  const speedSlider = document.getElementById('didactic-speed-slider');
  const speedLabel = document.getElementById('didactic-speed-label');
  speedSlider.addEventListener('input', (e) => {
    state.didacticSpeed = parseInt(e.target.value, 10);
    speedLabel.textContent = `${state.didacticSpeed}ms`;
  });

  // Gaveta Lateral Teórica
  document.getElementById('btn-open-drawer').addEventListener('click', openDrawer);
  document.getElementById('btn-close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);

  // Compartilhar URL
  document.getElementById('btn-share-url').addEventListener('click', copyShareURL);

  // Modal JSON
  document.getElementById('btn-open-json').addEventListener('click', openJSONModal);
  document.getElementById('btn-close-json-modal').addEventListener('click', closeJSONModal);
  document.getElementById('json-modal-backdrop').addEventListener('click', closeJSONModal);
  document.getElementById('btn-copy-json').addEventListener('click', copyJSONToClipboard);
  document.getElementById('btn-import-json').addEventListener('click', importJSONData);
}

// ============================================================================
// 5. RENDERIZAÇÃO DA PALETA DE DOMINÓS (D)
// ============================================================================
function renderDominoPalette() {
  const container = document.getElementById('domino-palette-container');
  const badgeCount = document.getElementById('domino-count-badge');
  badgeCount.textContent = state.dominoes.length;

  container.innerHTML = '';

  if (state.dominoes.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-slate-500 italic py-6 text-center w-full">
        Nenhum dominó disponível. Crie um no formulário acima ou selecione um preset!
      </div>
    `;
    return;
  }

  state.dominoes.forEach((domino) => {
    const tile = document.createElement('div');
    tile.className = 'domino-tile group';
    tile.dataset.id = domino.id;
    tile.title = `Clique para adicionar à esteira (ID: #${domino.id})`;

    tile.innerHTML = `
      <span class="domino-badge">#${domino.id}</span>
      
      <!-- Botão de exclusão rápida no hover -->
      <button class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm z-10" title="Excluir este dominó" data-delete-id="${domino.id}">
        ✕
      </button>

      <div class="domino-half domino-top font-mono-code">${escapeHTML(domino.top)}</div>
      <div class="domino-divider"></div>
      <div class="domino-half domino-bottom font-mono-code">${escapeHTML(domino.bottom)}</div>
    `;

    // Clique no dominó adiciona à esteira manual
    tile.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-id]')) return; // ignorar clique no botão de deletar
      addDominoToConveyor(domino.id);
    });

    // Clique no botão de deletar
    const deleteBtn = tile.querySelector('[data-delete-id]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDomino(domino.id);
      });
    }

    container.appendChild(tile);
  });
}

function deleteDomino(id) {
  state.dominoes = state.dominoes.filter(d => d.id !== id);
  // Remove também ocorrências na esteira manual se desejado
  state.conveyorSequence = state.conveyorSequence.filter(domId => domId !== id);
  renderDominoPalette();
  updateConveyorBelt();
  syncStateToURL();
  showToast(`Dominó #${id} removido.`, 'info');
}

// ============================================================================
// 6. ESTEIRA DE DOMINÓS (CONVEYOR) & COMPARADOR DE FITAS DUPLAS
// ============================================================================
function addDominoToConveyor(dominoId) {
  state.conveyorSequence.push(dominoId);
  updateConveyorBelt();
}

function undoConveyorDomino() {
  if (state.conveyorSequence.length > 0) {
    state.conveyorSequence.pop();
    updateConveyorBelt();
  }
}

function clearConveyorBelt() {
  state.conveyorSequence = [];
  updateConveyorBelt();
}

function updateConveyorBelt() {
  const listEl = document.getElementById('conveyor-dominoes-list');
  const badgeEl = document.getElementById('conveyor-length-badge');
  const btnUndo = document.getElementById('btn-undo-domino');
  const btnClear = document.getElementById('btn-clear-conveyor');

  const count = state.conveyorSequence.length;
  badgeEl.textContent = `${count} peça${count === 1 ? '' : 's'}`;
  btnUndo.disabled = count === 0;
  btnClear.disabled = count === 0;

  listEl.innerHTML = '';

  if (count === 0) {
    listEl.innerHTML = `
      <div class="text-xs text-slate-500 italic mx-auto py-4">
        Nenhum dominó na esteira. Clique em um dominó da paleta para começar ou use o solver.
      </div>
    `;
    renderTapeTracks('', '');
    updateTapeStatusBanner({ isMatch: false, isEmpty: true });
    return;
  }

  // Mapa rápido de dominós
  const dominoMap = new Map();
  state.dominoes.forEach(d => dominoMap.set(d.id, d));

  let topStr = '';
  let bottomStr = '';

  state.conveyorSequence.forEach((domId, index) => {
    const d = dominoMap.get(domId);
    if (!d) return;

    topStr += d.top;
    bottomStr += d.bottom;

    const tile = document.createElement('div');
    tile.className = 'domino-tile domino-mini relative shrink-0 group';
    tile.title = `Passo ${index + 1} na sequência (Dominó #${d.id}). Clique para remover.`;

    tile.innerHTML = `
      <span class="domino-badge">#${index + 1}</span>
      <button class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm z-10">
        ✕
      </button>
      <div class="domino-half domino-top font-mono-code">${escapeHTML(d.top)}</div>
      <div class="domino-divider"></div>
      <div class="domino-half domino-bottom font-mono-code">${escapeHTML(d.bottom)}</div>
    `;

    // Clicar em um dominó montado na esteira remove-o daquela posição
    tile.addEventListener('click', () => {
      state.conveyorSequence.splice(index, 1);
      updateConveyorBelt();
    });

    listEl.appendChild(tile);
  });

  // Renderiza fitas duplas alinhadas
  renderTapeTracks(topStr, bottomStr);
}

/**
 * Renderizador de células de fita caractere por caractere
 */
function renderTapeTracks(topStr, bottomStr) {
  const trackTop = document.getElementById('tape-track-top');
  const trackBottom = document.getElementById('tape-track-bottom');
  const topLenSpan = document.getElementById('tape-top-len');
  const bottomLenSpan = document.getElementById('tape-bottom-len');

  topLenSpan.textContent = topStr.length;
  bottomLenSpan.textContent = bottomStr.length;

  trackTop.innerHTML = '';
  trackBottom.innerHTML = '';

  const maxLen = Math.max(topStr.length, bottomStr.length);

  if (maxLen === 0) {
    trackTop.innerHTML = '<span class="text-xs text-slate-600 font-mono py-1 px-2">vazio</span>';
    trackBottom.innerHTML = '<span class="text-xs text-slate-600 font-mono py-1 px-2">vazio</span>';
    return;
  }

  let firstMismatch = -1;
  const isExactMatch = topStr.length > 0 && topStr === bottomStr;

  // Encontra primeiro ponto de divergência
  const minLen = Math.min(topStr.length, bottomStr.length);
  for (let i = 0; i < minLen; i++) {
    if (topStr[i] !== bottomStr[i]) {
      firstMismatch = i;
      break;
    }
  }

  for (let i = 0; i < maxLen; i++) {
    const charTop = topStr[i];
    const charBottom = bottomStr[i];

    // Status da célula
    let cellTopClass = 'tape-cell';
    let cellBottomClass = 'tape-cell';

    if (charTop !== undefined && charBottom !== undefined) {
      if (charTop === charBottom) {
        cellTopClass += ' cell-match';
        cellBottomClass += ' cell-match';
      } else {
        cellTopClass += ' cell-mismatch';
        cellBottomClass += ' cell-mismatch';
      }
    } else if (charTop !== undefined) {
      cellTopClass += ' cell-remainder';
      cellBottomClass += ' cell-empty';
    } else {
      cellTopClass += ' cell-empty';
      cellBottomClass += ' cell-remainder';
    }

    // Top Cell
    const cellTopEl = document.createElement('div');
    cellTopEl.className = cellTopClass;
    cellTopEl.innerHTML = `
      <span class="tape-cell-index">${i + 1}</span>
      <span>${charTop !== undefined ? escapeHTML(charTop) : '&nbsp;'}</span>
    `;
    trackTop.appendChild(cellTopEl);

    // Bottom Cell
    const cellBottomEl = document.createElement('div');
    cellBottomEl.className = cellBottomClass;
    cellBottomEl.innerHTML = `
      <span class="tape-cell-index">${i + 1}</span>
      <span>${charBottom !== undefined ? escapeHTML(charBottom) : '&nbsp;'}</span>
    `;
    trackBottom.appendChild(cellBottomEl);
  }

  // Atualiza banner de status
  updateTapeStatusBanner({
    isEmpty: false,
    isMatch: isExactMatch,
    firstMismatch,
    topStr,
    bottomStr
  });
}

function updateTapeStatusBanner({ isEmpty, isMatch, firstMismatch, topStr, bottomStr }) {
  const banner = document.getElementById('tape-status-banner');
  const content = document.getElementById('tape-status-content');
  const detail = document.getElementById('tape-status-detail');

  banner.className = 'rounded-lg p-2.5 text-xs font-medium flex items-center justify-between border transition';

  if (isEmpty) {
    banner.classList.add('bg-slate-800/80', 'border-white/10', 'text-slate-300');
    content.innerHTML = `
      <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
      <span>Esteira vazia. Clique nas peças para montar ou execute o Solver.</span>
    `;
    detail.textContent = '';
    return;
  }

  if (isMatch) {
    banner.classList.add('bg-emerald-950/60', 'border-emerald-500/60', 'text-emerald-300', 'tape-matched-glow');
    content.innerHTML = `
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
      <span class="font-bold">🎉 CORRESPONDÊNCIA EXATA ENCONTRADA! (${state.conveyorSequence.length} peças)</span>
    `;
    detail.textContent = `String: "${topStr}"`;
    return;
  }

  if (firstMismatch !== -1) {
    banner.classList.add('bg-rose-950/50', 'border-rose-600/60', 'text-rose-300');
    content.innerHTML = `
      <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
      <span><strong>Divergência detectada</strong> no caractere ${firstMismatch + 1} (Topo: '${topStr[firstMismatch]}' ≠ Base: '${bottomStr[firstMismatch]}')</span>
    `;
    detail.textContent = 'Poda de Prefixo Violada';
    return;
  }

  // Prefixo mantido, mas com tamanho desigual
  const diff = Math.abs(topStr.length - bottomStr.length);
  const leadingSide = topStr.length > bottomStr.length ? 'Fita Superior' : 'Fita Inferior';
  const remainder = topStr.length > bottomStr.length ? topStr.slice(bottomStr.length) : bottomStr.slice(topStr.length);

  banner.classList.add('bg-amber-950/40', 'border-amber-600/50', 'text-amber-300');
  content.innerHTML = `
    <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
    <span><strong>Prefixo Válido:</strong> ${leadingSide} adiantada em ${diff} caractere${diff === 1 ? '' : 's'}</span>
  `;
  detail.textContent = `Excesso (cauda): "${remainder}"`;
}

// ============================================================================
// 7. MOTOR AUTOMÁTICO (SOLVER VIA WEB WORKER)
// ============================================================================
function startWebWorkerSolve() {
  if (state.isSolving) {
    showToast('Uma busca já está em andamento.', 'info');
    return;
  }

  if (state.dominoes.length === 0) {
    showToast('Adicione pelo menos um dominó para resolver.', 'error');
    return;
  }

  // Se o modo didático estiver ativo, pausa
  pauseDidactic();

  state.isSolving = true;
  const btnFastSolve = document.getElementById('btn-fast-solve');
  btnFastSolve.disabled = true;
  btnFastSolve.innerHTML = `
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
    <span>Buscando em Worker...</span>
  `;

  const resultContainer = document.getElementById('solver-result-container');
  resultContainer.className = 'rounded-xl p-3 bg-slate-900/90 border border-cyan-500/30 text-xs text-cyan-300 flex items-center justify-between';
  resultContainer.innerHTML = '<span>Explorando árvore de busca BFS com podas inteligentes...</span>';
  resultContainer.classList.remove('hidden');

  try {
    state.activeWorker = createPCPWorker();

    state.activeWorker.onmessage = (e) => {
      const { type, data } = e.data;

      if (type === 'PROGRESS') {
        state.metrics.explored = data.nodesExplored;
        state.metrics.queue = data.queueSize;
        state.metrics.time = data.elapsedMs;
        updateMetricsDisplay();
      } else if (type === 'COMPLETE') {
        finishWebWorkerSolve(data);
      }
    };

    state.activeWorker.onerror = (err) => {
      console.error('Worker error:', err);
      showToast('Erro no Web Worker. Executando fallback na main thread.', 'error');
      // Fallback síncrono
      const fallbackResult = solvePCP(state.dominoes, state.maxK);
      finishWebWorkerSolve(fallbackResult);
    };

    // Dispara a busca
    state.activeWorker.postMessage({
      dominoes: state.dominoes,
      maxK: state.maxK
    });

  } catch (err) {
    console.warn('Falha ao instanciar Worker via Blob, fallback para thread principal:', err);
    setTimeout(() => {
      const res = solvePCP(state.dominoes, state.maxK);
      finishWebWorkerSolve(res);
    }, 20);
  }
}

function finishWebWorkerSolve(result) {
  state.isSolving = false;
  if (state.activeWorker) {
    state.activeWorker.terminate();
    state.activeWorker = null;
  }

  const btnFastSolve = document.getElementById('btn-fast-solve');
  btnFastSolve.disabled = false;
  btnFastSolve.innerHTML = `
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
    <span>Resolver com Web Worker</span>
  `;

  // Atualiza métricas finais
  state.metrics.time = result.executionTimeMs.toFixed(2);
  state.metrics.explored = result.nodesExplored;
  state.metrics.prunedPrefix = result.nodesPrunedPrefix;
  state.metrics.prunedCycle = result.nodesPrunedCycle;
  state.metrics.prunedDepth = result.nodesPrunedDepth;
  state.metrics.queue = 0;
  updateMetricsDisplay();

  const resultContainer = document.getElementById('solver-result-container');
  resultContainer.classList.remove('hidden');

  if (result.hasSolution) {
    const seqStr = result.solution.sequence.map(id => `#${id}`).join(' → ');
    resultContainer.className = 'rounded-xl p-4 bg-emerald-950/40 border border-emerald-500/50 text-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3';
    resultContainer.innerHTML = `
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-slate-950">SOLUÇÃO ENCONTRADA</span>
          <span class="text-xs text-emerald-400 font-semibold font-mono">${result.solution.sequence.length} peças (m ≤ ${state.maxK})</span>
        </div>
        <div class="text-xs font-mono text-slate-300">
          Sequência: <span class="text-cyan-300 font-bold">${seqStr}</span> &bull; String: <span class="text-emerald-400 font-bold">"${result.solution.string}"</span>
        </div>
      </div>
      <button id="btn-load-solution" class="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/30 shrink-0">
        Carregar na Esteira 📥
      </button>
    `;

    document.getElementById('btn-load-solution').addEventListener('click', () => {
      state.conveyorSequence = [...result.solution.sequence];
      updateConveyorBelt();
      showToast('Solução carregada na esteira interativa!', 'success');
    });

    showToast(`Solução encontrada com ${result.solution.sequence.length} dominós!`, 'success');
  } else {
    resultContainer.className = 'rounded-xl p-4 bg-amber-950/40 border border-amber-600/50 text-slate-200 flex flex-col gap-1';
    resultContainer.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-slate-950">SEM SOLUÇÃO</span>
        <span class="text-xs text-amber-300 font-semibold">Nenhuma correspondência com m ≤ ${state.maxK}</span>
      </div>
      <p class="text-xs text-slate-400">
        O algoritmo esgotou todas as combinações válidas ou podou os ramos inviáveis. Tente aumentar o limite K ou alterar as peças.
      </p>
    `;
    showToast(`Nenhuma solução existe para K ≤ ${state.maxK}.`, 'info');
  }
}

// ============================================================================
// 8. MODO DIDÁTICO PASSO A PASSO (STEP-BY-STEP STEPPER)
// ============================================================================
function toggleDidacticMode() {
  state.isDidacticMode = !state.isDidacticMode;
  const panel = document.getElementById('didactic-controls-panel');
  const logPanel = document.getElementById('didactic-log-container');

  if (state.isDidacticMode) {
    panel.classList.remove('hidden');
    logPanel.classList.remove('hidden');
    resetDidactic();
    showToast('Modo Didático Ativado. Clique em "Próximo Passo" ou "Executar".', 'info');
  } else {
    panel.classList.add('hidden');
    logPanel.classList.add('hidden');
    pauseDidactic();
    clearActiveEvalDomino();
  }
}

function resetDidactic() {
  pauseDidactic();
  state.didacticGenerator = solvePCPStepByStep(state.dominoes, state.maxK);
  document.getElementById('didactic-log-entries').innerHTML = '';
  clearActiveEvalDomino();
  appendDidacticLog(`Iniciado novo gerador com ${state.dominoes.length} dominós e K=${state.maxK}.`);
}

function toggleDidacticPlay() {
  const playBtn = document.getElementById('btn-didactic-play');
  if (state.didacticRunning) {
    pauseDidactic();
  } else {
    state.didacticRunning = true;
    playBtn.textContent = '⏸ Pausar';
    playBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
    playBtn.classList.add('bg-amber-600', 'hover:bg-amber-500');
    runDidacticLoop();
  }
}

function pauseDidactic() {
  state.didacticRunning = false;
  if (state.didacticTimer) {
    clearTimeout(state.didacticTimer);
    state.didacticTimer = null;
  }
  const playBtn = document.getElementById('btn-didactic-play');
  if (playBtn) {
    playBtn.textContent = '▶ Executar';
    playBtn.classList.remove('bg-amber-600', 'hover:bg-amber-500');
    playBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
  }
}

async function runDidacticLoop() {
  if (!state.didacticRunning) return;
  const done = await stepDidactic();
  if (!done && state.didacticRunning) {
    state.didacticTimer = setTimeout(runDidacticLoop, state.didacticSpeed);
  } else {
    pauseDidactic();
  }
}

async function stepDidactic() {
  if (!state.didacticGenerator) {
    state.didacticGenerator = solvePCPStepByStep(state.dominoes, state.maxK);
  }

  const { value, done } = await state.didacticGenerator.next();

  if (done || !value) {
    appendDidacticLog('🏁 Busca concluída ou gerador finalizado.');
    clearActiveEvalDomino();
    return true;
  }

  // Atualiza métricas se fornecidas no step
  if (value.stats) {
    state.metrics.explored = value.stats.nodesExplored;
    state.metrics.prunedPrefix = value.stats.nodesPrunedPrefix;
    state.metrics.prunedCycle = value.stats.nodesPrunedCycle;
    state.metrics.prunedDepth = value.stats.nodesPrunedDepth;
    state.metrics.queue = value.stats.queueSize || 0;
    if (value.stats.executionTimeMs) {
      state.metrics.time = value.stats.executionTimeMs.toFixed(2);
    }
    updateMetricsDisplay();
  }

  // Processa o tipo de evento didático
  switch (value.type) {
    case 'START':
      appendDidacticLog(`🚀 ${value.message}`);
      break;

    case 'EVALUATING_INITIAL':
      highlightDomino(value.domino.id);
      if (value.compatible) {
        appendDidacticLog(`🌱 Dominó #${value.domino.id} aceito como raiz: ${value.reason}`, 'emerald');
      } else {
        appendDidacticLog(`❌ Dominó #${value.domino.id} podado na raiz: ${value.reason}`, 'rose');
      }
      break;

    case 'EXPANDING_NODE':
      appendDidacticLog(`🔍 Expandindo nó [${value.node.sequence.map(id => '#' + id).join(' → ')}] (profundidade ${value.node.depth})`);
      state.conveyorSequence = [...value.node.sequence];
      updateConveyorBelt();
      break;

    case 'CANDIDATE_REJECTED_PREFIX':
      highlightDomino(value.domino.id);
      appendDidacticLog(`✂️ Dominó #${value.domino.id} rejeitado: ${value.reason}`, 'rose');
      break;

    case 'CANDIDATE_REJECTED_CYCLE':
      highlightDomino(value.domino.id);
      appendDidacticLog(`🔄 Dominó #${value.domino.id} podado por ciclo de cauda: ${value.reason}`, 'amber');
      break;

    case 'PRUNED_DEPTH':
      appendDidacticLog(`⛔ Poda por limite K atingido (${value.node.depth}): ${value.reason}`, 'purple');
      break;

    case 'CANDIDATE_ACCEPTED':
      highlightDomino(value.domino.id);
      appendDidacticLog(`✅ Dominó #${value.domino.id} anexado com sucesso! Nova cauda: "${value.nextNode.remainder}"`, 'cyan');
      state.conveyorSequence = [...value.nextNode.sequence];
      updateConveyorBelt();
      break;

    case 'SOLUTION_FOUND':
      highlightDomino(value.node.sequence[value.node.sequence.length - 1]);
      state.conveyorSequence = [...value.solution.sequence];
      updateConveyorBelt();
      appendDidacticLog(`🎉 SOLUÇÃO ENCONTRADA! Sequência [${value.solution.sequence.map(id => '#' + id).join(' → ')}] = "${value.solution.string}"`, 'emerald');
      finishWebWorkerSolve({
        hasSolution: true,
        solution: value.solution,
        executionTimeMs: value.stats.executionTimeMs || 0,
        nodesExplored: value.stats.nodesExplored,
        nodesPrunedPrefix: value.stats.nodesPrunedPrefix,
        nodesPrunedCycle: value.stats.nodesPrunedCycle,
        nodesPrunedDepth: value.stats.nodesPrunedDepth
      });
      return true;

    case 'NO_SOLUTION':
      appendDidacticLog(`🛑 ${value.message}`, 'amber');
      finishWebWorkerSolve({
        hasSolution: false,
        executionTimeMs: value.stats.executionTimeMs || 0,
        nodesExplored: value.stats.nodesExplored,
        nodesPrunedPrefix: value.stats.nodesPrunedPrefix,
        nodesPrunedCycle: value.stats.nodesPrunedCycle,
        nodesPrunedDepth: value.stats.nodesPrunedDepth
      });
      return true;
  }

  return false;
}

function appendDidacticLog(text, color = 'slate') {
  const container = document.getElementById('didactic-log-entries');
  const div = document.createElement('div');
  
  const colorMap = {
    slate: 'text-slate-300',
    emerald: 'text-emerald-400 font-semibold',
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-300',
    purple: 'text-purple-400'
  };

  div.className = `${colorMap[color] || 'text-slate-300'} text-[11px] font-mono leading-relaxed`;
  div.textContent = `> ${text}`;
  container.appendChild(div);

  const parent = document.getElementById('didactic-log-container');
  parent.scrollTop = parent.scrollHeight;
}

function highlightDomino(id) {
  clearActiveEvalDomino();
  const el = document.querySelector(`.domino-tile[data-id="${id}"]`);
  if (el) {
    el.classList.add('active-eval');
  }
}

function clearActiveEvalDomino() {
  document.querySelectorAll('.domino-tile.active-eval').forEach(el => el.classList.remove('active-eval'));
}

// ============================================================================
// 9. ATUALIZAÇÃO DO DASHBOARD DE MÉTRICAS
// ============================================================================
function updateMetricsDisplay() {
  document.getElementById('metric-time').textContent = `${state.metrics.time} ms`;
  document.getElementById('metric-explored').textContent = state.metrics.explored.toLocaleString();
  document.getElementById('metric-pruned-prefix').textContent = state.metrics.prunedPrefix.toLocaleString();
  document.getElementById('metric-pruned-cycle').textContent = state.metrics.prunedCycle.toLocaleString();
  document.getElementById('metric-pruned-depth').textContent = state.metrics.prunedDepth.toLocaleString();
  document.getElementById('metric-queue').textContent = state.metrics.queue.toLocaleString();
}

// ============================================================================
// 10. GAVETA LATERAL TEÓRICA (THEORETICAL DRAWER)
// ============================================================================
function openDrawer() {
  const container = document.getElementById('drawer-container');
  const panel = document.getElementById('drawer-panel');

  container.classList.remove('pointer-events-none', 'opacity-0');
  container.classList.add('opacity-100');
  panel.classList.remove('translate-x-full');
}

function closeDrawer() {
  const container = document.getElementById('drawer-container');
  const panel = document.getElementById('drawer-panel');

  panel.classList.add('translate-x-full');
  container.classList.remove('opacity-100');
  container.classList.add('opacity-0', 'pointer-events-none');
}

// ============================================================================
// 11. CARREGAMENTO DE PRESETS
// ============================================================================
function loadPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  state.dominoes = JSON.parse(JSON.stringify(preset.dominoes));
  state.maxK = preset.k;
  state.nextDominoId = Math.max(...state.dominoes.map(d => d.id), 0) + 1;
  state.conveyorSequence = [];

  // Atualiza controles
  document.getElementById('slider-max-k').value = Math.min(15, preset.k);
  document.getElementById('input-max-k').value = preset.k;
  document.getElementById('display-max-k').textContent = preset.k;

  renderDominoPalette();
  updateConveyorBelt();
  syncStateToURL();

  // Se modo didático estiver ativo, reinicia gerador
  if (state.isDidacticMode) {
    resetDidactic();
  }

  showToast(`Preset "${preset.name}" carregado com sucesso!`, 'success');
}

// ============================================================================
// 12. PERSISTÊNCIA EM URL HASH & JSON IMPORT/EXPORT
// ============================================================================
function syncStateToURL() {
  try {
    const payload = {
      k: state.maxK,
      d: state.dominoes.map(d => ({ i: d.id, t: d.top, b: d.bottom }))
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    window.location.hash = `state=${encoded}`;
  } catch (e) {
    console.warn('Falha ao serializar estado na URL:', e);
  }
}

function loadStateFromURL() {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#state=')) return;

    const base64 = hash.replace('#state=', '');
    const jsonStr = decodeURIComponent(atob(base64));
    const parsed = JSON.parse(jsonStr);

    if (parsed.d && Array.isArray(parsed.d)) {
      state.dominoes = parsed.d.map(item => ({
        id: item.i,
        top: item.t,
        bottom: item.b
      }));
      state.nextDominoId = Math.max(...state.dominoes.map(d => d.id), 0) + 1;
    }

    if (parsed.k) {
      state.maxK = parseInt(parsed.k, 10) || 7;
    }
  } catch (e) {
    console.warn('URL hash com formato inválido, carregando padrão.', e);
  }
}

function copyShareURL() {
  syncStateToURL();
  navigator.clipboard.writeText(window.location.href).then(() => {
    showToast('Link da instância copiado para a área de transferência! 🔗', 'success');
  }).catch(() => {
    prompt('Copie o link abaixo:', window.location.href);
  });
}

function openJSONModal() {
  const container = document.getElementById('json-modal-container');
  const textarea = document.getElementById('json-textarea');
  container.classList.remove('pointer-events-none', 'opacity-0');
  container.classList.add('opacity-100');

  textarea.value = JSON.stringify(state.dominoes, null, 2);
}

function closeJSONModal() {
  const container = document.getElementById('json-modal-container');
  container.classList.remove('opacity-100');
  container.classList.add('opacity-0', 'pointer-events-none');
}

function copyJSONToClipboard() {
  const textarea = document.getElementById('json-textarea');
  navigator.clipboard.writeText(textarea.value).then(() => {
    showToast('JSON copiado com sucesso!', 'success');
  });
}

function importJSONData() {
  const textarea = document.getElementById('json-textarea');
  try {
    const data = JSON.parse(textarea.value);
    if (!Array.isArray(data)) throw new Error('O JSON deve ser um array de dominós.');

    const validated = [];
    let maxId = 0;

    data.forEach((item, idx) => {
      if (!item.top || !item.bottom) throw new Error(`Item ${idx + 1} inválido: requer "top" e "bottom"`);
      const id = typeof item.id === 'number' ? item.id : idx + 1;
      maxId = Math.max(maxId, id);
      validated.push({
        id,
        top: String(item.top).trim().toLowerCase(),
        bottom: String(item.bottom).trim().toLowerCase()
      });
    });

    state.dominoes = validated;
    state.nextDominoId = maxId + 1;
    state.conveyorSequence = [];

    renderDominoPalette();
    updateConveyorBelt();
    syncStateToURL();
    closeJSONModal();
    showToast(`${validated.length} dominós importados com sucesso!`, 'success');
  } catch (err) {
    alert(`Erro ao importar JSON: ${err.message}`);
  }
}

// ============================================================================
// 13. UTILITÁRIOS (TOASTS, SANITIZAÇÃO)
// ============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <span>${icons[type] || 'ℹ️'}</span>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
