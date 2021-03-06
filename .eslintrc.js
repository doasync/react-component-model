// ESLint root is here
process.chdir(__dirname);

module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    allowImportExportEverywhere: true,
    codeFrame: false,
  },
  extends: [
    'plugin:flowtype/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:promise/recommended',
    'airbnb',
  ],
  plugins: [
    'flowtype',
    'promise',
    'html',
  ],
  settings: {
    'import/resolver': {
      webpack: {
        config: './webpack/webpack.common.js',
      },
    },
    flowtype: {
      onlyFilesWithFlowAnnotation: false,
    },
  },
  rules: {
    'import/prefer-default-export': 'off', // prefer named export
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'always', // use space
      asyncArrow: 'always',
    }],
    'react/jsx-filename-extension': ['error', {
      extensions: ['.js'], // no .jsx
    }],
    'eslint-comments/disable-enable-pair': ['error', {
      allowWholeFile: true,
    }],
    'no-restricted-syntax': [
      'error',
      'ForInStatement',
      'LabeledStatement',
      'WithStatement',
      "BinaryExpression[operator='in']",
    ],
    'spaced-comment': ['error', 'always', { markers: [':', '::'] }],
  },
};
