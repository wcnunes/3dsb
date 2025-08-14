# 3DScan – Medições com Câmera para CAD/3D

**3DScan** é uma ferramenta web que transforma seu navegador em um instrumento de medição visual, usando a câmera do seu dispositivo para capturar imagens, marcar pontos, medir distâncias e ângulos, e exportar dados para uso em modelagem CAD e impressão 3D.

## O que a ferramenta faz
- Permite capturar imagens da câmera do computador ou celular.
- Marca pontos e linhas diretamente sobre a imagem congelada.
- Mede distâncias e ângulos entre pontos.
- Calibra a escala usando um objeto de referência real (ex: régua, cartão).
- Exporta medições em PNG, CSV, JSON e DXF para uso em softwares CAD/3D.
- Suporte a múltiplas unidades (mm, cm, polegadas).
- Filtro de bordas para destacar detalhes do objeto.
- Funciona em qualquer navegador moderno, inclusive no celular.
- Pode ser instalado como app (PWA) para uso offline.

## Como usar
1. **Acesse a ferramenta** pelo navegador (desktop ou mobile).
2. **Permita o acesso à câmera** quando solicitado.
3. **Posicione o objeto** e um item de referência de tamanho conhecido no campo de visão.
4. **Congele o quadro** e use as ferramentas para marcar pontos, medir distâncias e ângulos.
5. **Calibre a escala** marcando dois pontos sobre o objeto de referência e informando seu tamanho real.
6. **Exporte os dados** no formato desejado para usar em seu fluxo de trabalho CAD/3D.

## Dicas para melhor aproveitamento
- Use sempre um objeto de referência (ex: cartão, régua) no mesmo plano do objeto a ser medido para garantir precisão.
- Evite ângulos de câmera muito inclinados para reduzir distorções de perspectiva.
- Utilize o filtro de bordas para facilitar a marcação de pontos em superfícies complexas.
- No celular, instale o app como PWA para acesso rápido e uso offline.
- Exporte em DXF para importar linhas diretamente em softwares CAD.
- Para medições mais precisas, calibre sempre que mudar a posição da câmera ou do objeto.

---

Desenvolvido para facilitar a integração entre o mundo físico e o digital, otimizando o processo de modelagem e prototipagem 3D.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
