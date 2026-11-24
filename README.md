# Harmony Clinical Center · Agenda

Sistema interno de agendamentos da **Harmony Clinical Center (Dra. Fabiana Azevedo)**.
É um site estático (HTML + CSS + JavaScript, sem etapa de build) com dados em tempo real no **Firebase Realtime Database** do projeto `harmony-clinical-center-db462`.

## Publicar (GitHub → Vercel)

1. Suba **o conteúdo desta pasta** para um repositório no GitHub (de preferência **privado**).
2. No Vercel: **Add New → Project** → escolha o repositório → *Framework Preset*: **Other**. Deixe Build Command e Output Directory vazios → **Deploy**.
3. Cada `git push` publica de novo automaticamente.

## Firebase (fazer uma vez)

1. **Authentication → Sign-in method** → ative **E-mail/senha**.
2. **Authentication → Users → Add user**: crie as contas no formato `nome@hcc.com`.
   No site, a pessoa digita só `nome`, e o sistema completa `@hcc.com` sozinho.
3. **Realtime Database → Regras**: cole o conteúdo de `database.rules.json` e clique em **Publicar**.
   As regras exigem login para ler e gravar e só aceitam agendamentos no formato correto.
4. **Trazer os dados do sistema antigo** (escolha uma opção):
   - **Pelo site (recomendado):** entre no sistema → **Ajustes → Importar planilha** → escolha `Relatorio_HCC_ESTETICA_6.xls`. Ele mostra uma prévia, ignora registros repetidos e importa.
   - **Pelo console:** Realtime Database → menu ⋮ → **Importar JSON** → envie `importar-no-firebase.json` (enviado à parte). ⚠️ A importação pela raiz **substitui todo o banco**. Use só com o banco vazio.

## Usuários e setores

- O usuário `hedney` vê o setor **Pilates** (pasta `pilates`). Os demais veem **Estética** (pasta `agendamentos`).
- Para mudar isso, edite `SETORES_POR_USUARIO` em `js/firebase-config.js`.

## O que tem

- **Agenda** com horários de 30 em 30 min (07:00–22:00), linha do horário atual, semana deslizante (celular) e calendário (computador). Para trocar de dia, deslize o dedo para os lados.
- **Concluir com um toque** no círculo ✓ de cada atendimento, com opção de desfazer.
- **Novo agendamento**: sugestão de clientes já atendidas, telefone preenchido sozinho, atalhos de procedimento, valor sugerido e horários separados em manhã, tarde e noite, com os ocupados riscados (dá para encaixar).
- **Detalhe**: remarcar, editar, cancelar, excluir (com desfazer), histórico da cliente e confirmação pelo WhatsApp.
- **Clientes**: busca por nome, telefone ou procedimento, e ordenação por recentes, visitas, gasto ou A–Z.
- **Financeiro**: recebido, a receber, ticket médio, comparação com o mês anterior, gráfico por dia (toque numa barra para ver o dia) e ranking de procedimentos.
- **Ajustes**: importar e exportar Excel, procedimentos com valor padrão e limpeza do banco (pede para digitar APAGAR).
- **Atalhos no computador**: `←` `→` trocam o dia · `T` hoje · `N` novo · `A`/`C`/`F` trocam de tela · `/` busca.
- Pode ser **instalado no celular** (Compartilhar → Adicionar à Tela de Início).

## Testar sem mexer nos dados reais

Abra com `?demo` no final do endereço (ex.: `https://seusite.vercel.app/?demo`). Os dados são fictícios e ficam salvos só no navegador. Qualquer usuário e senha entram.

## Estrutura

```
index.html              telas
css/style.css           identidade visual e animações
js/app.js               lógica da agenda
js/store.js             Firebase (ou modo demonstração)
js/excel.js             importar/exportar planilhas (SheetJS, carregado sob demanda)
js/firebase-config.js   chaves do Firebase, sufixo @hcc.com, setores, procedimentos, horários
database.rules.json     regras do Realtime Database
assets/                 logo e ícones
sw.js, manifest.webmanifest   instalação no celular
vercel.json             cabeçalhos (não aparece no Google)
```
