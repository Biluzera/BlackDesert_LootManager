# BDO Loot Log

Aplicativo desktop para rastrear sessões de farm, registrar itens e acompanhar estatísticas no Black Desert Online. Construído com Electron + React + TypeScript via electron-vite.

---

## Funcionalidades

### 🏰 Início
- Dashboard com resumo geral: total acumulado em prata, local de farm mais utilizado e histórico das 5 sessões mais recentes.
- **Transferência de Dados**: exporta todos os itens, locais e imagens cadastrados em um único arquivo compactado para compartilhar com amigos ou fazer backup; importa um arquivo exportado anteriormente, substituindo os dados atuais.
- Todos os dados são armazenados localmente em arquivos `.json` no próprio computador do usuário — sem nenhum servidor externo.

### 💎 Registro de Itens
- Cadastro de itens com nome, preço manual em prata e imagem personalizada.
- **ID de Mercado** (opcional): vincule o ID do item na [arsha.io](https://arsha.io) para buscar automaticamente o preço de mercado em tempo real via API. O preço de mercado tem prioridade sobre o preço manual enquanto estiver disponível.
- Filtro por nome e por local de farm associado.
- Ordenação por nome (A-Z / Z-A) e por preço (crescente / decrescente) — o preço considerado na ordenação é o preço efetivo (mercado ou manual).
- Edição e remoção de itens existentes.
- **Taxa de drop por item**: exibe, para cada item cadastrado, a quantidade média obtida por hora e por sessão, calculada automaticamente com base no histórico de todas as sessões registradas.

### 🗺️ Locais de Farm
- Registro de locais com nome, imagem e lista de itens obtidos naquele local.
- Busca de itens por nome via dropdown ao vincular itens a um local.
- Associação direta entre itens e locais para facilitar o registro de sessões.
- **Estatísticas por local**: cada card exibe o número de sessões realizadas, prata total acumulada, média de prata por sessão e média de prata/hora com base no histórico.

### 📜 Sessões de Farm
- Registro de sessões com local, data, duração (horas + minutos) e notas livres.
- Controle de quantidade antes e depois de cada sessão por item.
- **Total e prata/hora em tempo real**: o modal de registro atualiza o total da sessão e a estimativa de prata/hora conforme as quantidades são preenchidas.
- **Fonte de preço por item**: cada item exibe um badge indicando se o preço usado é proveniente da API de mercado (🏪 Mercado) ou configurado manualmente (✋ Manual).
- **Snapshot de preço**: o preço de cada item é salvo no momento do registro da sessão, preservando o valor histórico mesmo que o preço seja alterado posteriormente.
- Cálculo automático do prata obtido por sessão com base nos preços efetivos.
- Edição e exclusão de sessões com confirmação.

### 📊 Estatísticas
- **Cards de resumo**: prata total, número de sessões, melhor sessão, média de prata/hora e melhor prata/hora registrada.
- Gráfico de linha com a evolução de prata por sessão ao longo do tempo.
- Gráfico de barras com prata/hora por local de farm.
- Gráfico de barras com prata total acumulada por local de farm (top 8).
- Ranking dos locais mais lucrativos.

### ⚔️ Bosses Mundiais
- Cadastro de bosses com nome, imagem e cor de destaque (paleta de cores predefinidas ou cor customizada).
- Definição de múltiplos horários de spawn por dia da semana.
- Contagem regressiva em tempo real até o próximo spawn (atualizada a cada segundo).
- **Alertas sonoros em 3 níveis**:
  - **15 minutos antes** — bipe duplo suave (440 Hz)
  - **5 minutos antes** — bipe triplo médio (660 Hz)
  - **3 minutos antes** — sequência urgente ascendente (880 → 1100 Hz)
- **Overlay de notificação visual**: um banner aparece na tela com o nome e imagem do boss, o tempo restante e o horário exato de spawn.
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
- **Modo Desenvolvedor**: preenche todas as abas com dados fictícios para testes de interface sem salvar nada — ao desativar, tudo volta ao estado real.
- **Debug de Mercado** (visível apenas no Modo Desenvolvedor): consulta os dados de qualquer item na API da arsha.io pelo ID, exibindo preço base, estoque e detalhes de preço.

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

