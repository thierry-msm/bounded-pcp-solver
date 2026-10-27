# Bounded-PCP: Resolvedor & Visualizador Interativo

> Uma aplicação web moderna (Single Page Application - SPA) 100% client-side para resolução, exploração e visualização didática do **Problema da Correspondência de Post Limitado (Bounded-PCP)**.

Pronta para execução local imediata ou hospedagem estática direta no **GitHub Pages**.

---

## 🎲 Sobre o Problema

### O PCP Clássico (Emil Post, 1946)
Dado um conjunto finito de peças de dominó bipartidas:
$$D = \left\{ \begin{bmatrix} t_1 \\ b_1 \end{bmatrix}, \begin{bmatrix} t_2 \\ b_2 \end{bmatrix}, \dots, \begin{bmatrix} t_n \\ b_n \end{bmatrix} \right\} \quad \text{onde } t_i, b_i \in \Sigma^+$$

O objetivo é encontrar uma sequência finita de índices $(i_1, i_2, \dots, i_m)$ com $m \ge 1$ tal que:
$$t_{i_1} t_{i_2} \dots t_{i_m} = b_{i_1} b_{i_2} \dots b_{i_m}$$

No caso irrestrito, o PCP é **indecidível** (provado através de redução direta a partir do *Problema da Parada de Máquinas de Turing*).

### O Bounded-PCP ($m \le K$)
Quando limitamos o comprimento máximo da sequência a $K$ peças:
1. **Torna-se Decidível:** O espaço de busca bruto é finito ($|D| + |D|^2 + \dots + |D|^K$).
2. **É NP-Completo:** Pode ser verificado em tempo polinomial $O(K \cdot L)$ e qualquer problema em NP se reduz a ele.

---

## ⚡ Funcionalidades da Aplicação

- **Motor BFS com Podas Inteligentes:**
  - **Poda de Raiz:** Apenas peças com compatibilidade inicial de prefixo entram na fila.
  - **Poda por Prefixo:** Descarte imediato caso o novo topo e a nova base divirjam em algum caractere.
  - **Poda de Estados Cíclicos/Redundantes:** Armazena pares `(tipo_de_excesso, remainder)` em um conjunto visitado em BFS.
  - **Poda por Profundidade ($K$):** Respeita o limite bound configurado pelo usuário.
- **Execução Híbrida (Web Worker & Stepper Didático):**
  - **Modo Rápido:** Executa em background em um Web Worker (via Blob URL), sem travar a interface e atualizando nós/métricas em tempo real.
  - **Modo Didático:** Executa passo a passo permitindo pausar, avançar frame a frame e entender exatamente por que cada peça foi aceita ou podada.
- **Esteira Manual e Comparador de Fitas (Dual-Tape Inspector):**
  - Permite montar sequências manualmente clicando nos dominós da paleta.
  - Exibe alinhamento caractere por caractere:
    - 🟩 **Verde Neon:** Caracteres coincidentes.
    - 🟥 **Vermelho Alerta:** Ponto imediato de divergência (com animação de pulso).
    - 🟨 **Âmbar:** Caracteres em excesso (remainder da fita adiantada).
    - 🏆 **Destaque Especial:** Efeito glow celebratório ao atingir casamento exato!
- **Gaveta Teórica Retrátil:**
  - Explicações didáticas profundas com formalismo matemático e histórico.
  - Botões para carregar presets clássicos diretamente na esteira:
    - *Exemplo 1: Sipser 5.15 (Livro de Michael Sipser - 5 peças: `abcaaabc`)*
    - *Exemplo 2: Solução Rápida (2 peças: `001`)*
    - *Exemplo 3: Match Imediato (1 peça)*
    - *Exemplo 4: Desafio Binário $\{0, 1\}$*
    - *Exemplo 5: Sem Solução em K*
- **Compartilhamento & Portabilidade:**
  - Sincronização automática do estado na URL (`#state=...`).
  - Importação e exportação de dominós em formato JSON.

---

## 🚀 Como Executar Localmente

Como a aplicação é 100% estática e não possui dependências de compilação ou backend:

### Opção 1: Servidor Local Simples (Python)
```bash
python3 -m http.server 4173
```
Abra [http://localhost:4173](http://localhost:4173) no seu navegador.

### Opção 2: Node.js (npx serve)
```bash
npx serve .
```

### Opção 3: Abrir direto no navegador
Você pode abrir o arquivo `index.html` diretamente em qualquer navegador moderno.

---

## 📂 Estrutura de Arquivos

```
bounded-pcp-solver/
├── index.html       # Markup semântico, Tailwind CDN, layout e gaveta teórica
├── style.css        # Efeitos visuais 3D nas peças de dominó, fitas de caracteres e animações
├── solver.js        # Motor matemático do BFS, podas de prefixo/ciclo, gerador de passos e Web Worker
├── app.js           # Gerenciamento de estado da UI, esteira interativa, eventos e URL sharing
└── README.md        # Documentação técnica e teórica
```

---

## 📚 Referências

- **Sipser, Michael.** *Introduction to the Theory of Computation* (3rd Edition). Cengage Learning, 2012. (Seção 5.2 - The Post Correspondence Problem).
- **Post, Emil L.** *A variant of a recursively unsolvable problem*. Bulletin of the American Mathematical Society, 1946.
- **Garey, Michael R.; Johnson, David S.** *Computers and Intractability: A Guide to the Theory of NP-Completeness*. W. H. Freeman, 1979.
