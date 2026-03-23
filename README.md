# Star Counter Online

Aplicação web para **detecção e contagem de estrelas em imagens astronômicas** diretamente no navegador.

O projeto permite carregar uma imagem, ajustar a sensibilidade de brilho, definir a faixa de diâmetro das estrelas detectadas e visualizar os resultados com marcações sobre a imagem, métricas técnicas e gráficos de apoio.

## Visão geral

O **Star Counter Online** foi desenvolvido para facilitar a análise visual e quantitativa de imagens astronômicas. A interface permite:

- carregar imagens em formatos comuns;
- ajustar a sensibilidade de detecção;
- filtrar estrelas por faixa de diâmetro;
- visualizar a imagem analisada com marcações;
- acompanhar histograma RGB;
- inspecionar a distribuição do número de estrelas por faixa de diâmetro;
- exportar a imagem processada com ou sem legenda.

## Features

- **Upload de imagem astronômica** com suporte a JPG, JPEG, PNG e TIFF
- **Ajuste de sensibilidade de brilho** via slider
- **Filtro por faixa de diâmetro detectado** com controle mínimo e máximo
- **Detecção automática de estrelas**
- **Preview da imagem com marcação visual das estrelas detectadas**
- **Resumo técnico da análise**
- **Cálculo de FWHM média**
- **Histograma RGB**
- **Gráfico de variação do número de estrelas por faixa de diâmetro**
- **Exportação da imagem marcada** em JPG ou PNG
- **Opção de exportar com legendas técnicas**
- **Modal de progresso da análise** com etapa atual e tempo estimado

## Como funciona

A aplicação executa a análise da imagem no navegador e utiliza uma abordagem baseada em:

- estimativa de fundo local por janela deslizante;
- limiar adaptativo por sigma local;
- rejeição de hot pixels e ruído;
- identificação de máximos locais candidatos;
- medição do perfil radial das estrelas;
- estimativa simplificada de **FWHM** e diâmetro detectado.

## Estrutura do projeto

```text
.
├── index.html
├── styles.css
└── app.js

## Como usar

### 1. Abra no navegador

Como o projeto é composto por arquivos estáticos, basta abrir o arquivo `index.html` no navegador.

Você também pode usar uma extensão como **Live Server** no VS Code para facilitar a execução local.

### 2. Carregue uma imagem

Clique em **Escolher imagem** ou arraste o arquivo para a área de upload.

### 3. Ajuste os parâmetros

Configure os controles disponíveis:

- **Threshold / sensibilidade de brilho**
- **Faixa de diâmetro detectado**
- **Formato de exportação**
- **Legenda na exportação**

### 4. Execute a análise

Clique em **Calcular Número de Estrelas** para processar a imagem.

### 5. Analise os resultados

A aplicação exibirá:

- imagem com marcação das estrelas detectadas;
- somatória de estrelas na faixa selecionada;
- valor médio de FWHM;
- resumo técnico;
- histograma RGB;
- gráfico de distribuição por faixa de diâmetro.

### 6. Exporte a imagem

Clique em **Exportar imagem marcada** para salvar o resultado em JPG ou PNG.

## Interface

A interface foi construída com foco em clareza visual e uso prático, incluindo:

- layout responsivo;
- cards com visual moderno;
- sliders de controle;
- área de preview;
- gráficos em canvas;
- feedback de progresso durante a análise.

## Tecnologias utilizadas

- **HTML5**
- **CSS3**
- **JavaScript puro (Vanilla JS)**
- **Canvas API**

## Possíveis usos

- análise preliminar de imagens astronômicas;
- inspeção visual de estrelas detectadas;
- comparação de sensibilidade de detecção;
- estudo exploratório de distribuição de diâmetro aparente;
- apoio a fluxos de processamento de imagens do céu profundo.

## Limitações

- o suporte a arquivos RAW pode depender do navegador;
- a detecção depende da qualidade da imagem e do ajuste dos parâmetros;
- resultados podem variar conforme ruído, hot pixels, foco e contraste da imagem;
- a medição é uma estimativa prática e não substitui pipelines científicos calibrados.

## ✉️ Contato

**Star Counter Online** foi desenvolvido no âmbido do **Programa de Doutorado em Educação em Ciências (PPGEduC)** da **Universidade de Brasília (UnB)**. Criado por **Lucas Ferreira (UnB/IF/PPGEduC)**.

Feedback e sugestões são muito bem-vindos!

Email: **lucasferreiraunb@gmail.com**