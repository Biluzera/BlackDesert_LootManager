# BDO Loot Log

Aplicativo desktop para rastrear sessões de farm, registrar itens e acompanhar estatísticas no Black Desert Online. Construído com Electron + React + TypeScript via electron-vite.

---

## Funcionalidades

### 🏰 Início
Dashboard com resumo geral: total acumulado em prata, local de farm mais utilizado e histórico das sessões mais recentes.

### 💎 Registro de Itens
- Cadastro de itens com nome, preço em prata e imagem personalizada.
- Filtro por nome e por local de farm associado.
- Ordenação por nome (A-Z / Z-A) e por preço (crescente / decrescente).
- Edição e remoção de itens existentes.

### 🗺️ Locais de Farm
- Registro de locais com nome, região, imagem e lista de itens obtidos naquele local.
- Associação direta entre itens e locais para facilitar o registro de sessões.

### 📜 Sessões de Farm
- Registro de sessões com local, data, duração (horas + minutos) e notas.
- Controle de quantidade antes e depois de cada sessão por item.
- Cálculo automático do prata obtido por sessão com base nos preços cadastrados.
- Edição e exclusão de sessões com confirmação.

### 📊 Estatísticas
- Total de prata acumulado em todas as sessões.
- Gráfico de evolução de prata por data.
- Gráfico de prata por hora (prata/h) por local de farm.
- Ranking dos locais mais lucrativos.

### ⚔️ Bosses Mundiais
- Cadastro de bosses com nome, imagem e cor de destaque.
- Definição de horários de spawn por dia da semana.
- Contagem regressiva em tempo real até o próximo spawn.
- Notificação sonora configurável antes do spawn.
- Agrupamento de bosses que spawnizam no mesmo horário.

### ⚙️ Configurações
- Seleção de tema visual com 10 opções:
  - Medieval Dourado, Crimson Sangue, Elvia Violeta, Noite Estrelada, Deserto de Valencia, Abismo Oceânico
  - Floresta de Kamasylve, Vulcão de Drieghan, Calpheon Aristocrático, Sombra Cinzenta
- Seleção de fonte da interface com 5 opções:
  - **Clássico Medieval** — Cinzel + Crimson Text (padrão)
  - **Velho Mundo** — IM Fell English, estilo manuscrito antigo
  - **Interface Moderna** — Rajdhani + Nunito, limpo e legível
  - **Runas Antigas** — Uncial Antiqua + Merriweather, estilo celta
  - **Diário de Aventureiro** — Special Elite + Courier Prime, máquina de escrever
- A fonte selecionada é aplicada globalmente em todas as páginas do sistema.

### ⏱ Timer Flutuante
Widget flutuante disponível em todas as telas para cronometrar sessões de farm com iniciar, pausar e resetar.

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- npm v9 ou superior

---

## Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/BlackDesert_LootManager.git
cd BlackDesert_LootManager

# Instale as dependências
npm install
```

---

## Como rodar

### Modo de desenvolvimento

```bash
npm run dev
```

Abre o aplicativo Electron com hot-reload ativado.

### Build de produção

```bash
npm run build
```

Gera os arquivos compilados na pasta `out/`.

### Preview da build

```bash
npm run preview
```

### Gerar instalador `.exe` (Windows)

```bash
npm run package
```

Gera o instalador `.exe` na pasta `dist/`. O processo compila o projeto via `electron-vite` e empacota com `electron-builder`.

**Requisitos para o build:**
- Rode o terminal como **Administrador**, ou ative o **Modo Desenvolvedor** do Windows (Configurações → Sistema → Para desenvolvedores).

**Ícone do aplicativo:**

Coloque um arquivo `icon.ico` em `resources/icon.ico` para personalizar o ícone do executável e do instalador. Tamanho recomendado: 256x256 px.

---

## Tecnologias utilizadas

| Tecnologia | Uso |
|---|---|
| [Electron](https://www.electronjs.org/) | Shell desktop |
| [React 18](https://react.dev/) | Interface |
| [TypeScript](https://www.typescriptlang.org/) | Tipagem estática |
| [electron-vite](https://electron-vite.org/) | Build e dev server |
| [electron-builder](https://www.electron.build/) | Empacotamento e geração do `.exe` |
| [Recharts](https://recharts.org/) | Gráficos de estatísticas |
| [Lucide React](https://lucide.dev/) | Ícones |

---

## Licença

[MIT](LICENSE)

