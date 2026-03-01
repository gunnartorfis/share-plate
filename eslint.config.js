//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'

export default [
  ...tanstackConfig,
  {
    files: ['**/*.{ts,tsx}', '!**/lib/i18n/**', '!**/eslint/**'],
    plugins: {
      'no-hardcoded-english': {
        rules: {
          'no-hardcoded-english': {
            meta: {
              type: 'problem',
              docs: {
                description:
                  'Disallow hard-coded English strings - use t() instead',
              },
              messages: {
                noHardcodedEnglish:
                  'Hard-coded English detected. Use t() from react-i18next instead of hard-coded strings.',
              },
              schema: [],
            },
            create(context) {
              return {
                JSXText(node) {
                  const text = node.value.trim()
                  if (
                    text.length > 0 &&
                    /^[a-zA-Z\s.,!?'"()-]+$/.test(text) &&
                    !text.includes('{{') &&
                    !text.includes('i18n') &&
                    !text.includes('.') // translation keys contain dots
                  ) {
                    context.report({
                      node,
                      messageId: 'noHardcodedEnglish',
                    })
                  }
                },
                Literal(node) {
                  if (
                    typeof node.value === 'string' &&
                    node.value.length > 0 &&
                    /^[a-zA-Z\s.,!?'"()-]+$/.test(node.value) &&
                    !node.value.includes('{{') &&
                    !node.value.includes('.') // translation keys contain dots
                  ) {
                    const parent = node.parent
                    if (
                      parent?.type === AST_NODE_TYPES.Property &&
                      parent.key.type === AST_NODE_TYPES.Identifier &&
                      (parent.key.name === 'placeholder' ||
                        parent.key.name === 'title' ||
                        parent.key.name === 'alt' ||
                        parent.key.name === 'aria-label' ||
                        parent.key.name === 'id')
                    ) {
                      return
                    }
                    if (
                      parent?.type === AST_NODE_TYPES.CallExpression &&
                      parent.callee.type === AST_NODE_TYPES.Identifier &&
                      (parent.callee.name === 't' ||
                        parent.callee.name === 'translate')
                    ) {
                      return
                    }
                    context.report({
                      node,
                      messageId: 'noHardcodedEnglish',
                    })
                  }
                },
              }
            },
          },
        },
      },
    },
    rules: {
      'no-hardcoded-english/no-hardcoded-english': 'error',
    },
  },
]
