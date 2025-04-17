import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { APIError, CollectionBeforeOperationHook, Plugin } from 'payload'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { getServerSideURL } from '@/utilities/getURL'
import { Post, Page } from '@/payload-types'

type Args = {
  max?: number
  warnAt?: number
}
const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Website Template` : 'Payload Website Template'
}

const generateURL: GenerateURL<Post | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

const opsCounterPlugin =
  (args?: Args): Plugin =>
  (config) => {
    const max = args?.max || 50
    const warnAt = args?.warnAt || 10

    const beforeOperationHook: CollectionBeforeOperationHook = ({ collection, operation, req }) => {
      const currentCount = req.context.opsCount

      if (typeof currentCount === 'number') {
        req.context.opsCount = currentCount + 1

        if (warnAt && currentCount >= warnAt) {
          req.payload.logger.error(
            `Detected a ${operation} in the "${collection.slug}" collection which has run ${warnAt} times or more.`,
          )
        }

        if (currentCount > max) {
          throw new APIError(`Maximum operations of ${max} detected.`)
        }
      } else {
        req.context.opsCount = 1
      }
    }

    ;(config.collections || []).forEach((collection) => {
      if (!collection.hooks) {
        collection.hooks = {}
      }
      if (!collection.hooks.beforeOperation) {
        collection.hooks.beforeOperation = []
      }

      collection.hooks.beforeOperation.push(beforeOperationHook)
    })
    return config
  }

export const plugins: Plugin[] = [
  opsCounterPlugin({
    max: 200,
    warnAt: 25,
  }),
  redirectsPlugin({
    // collections: [ 'pages', 'posts'],
    overrides: {
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['pages'],
    generateLabel: (_, doc) => doc.title as string,
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug as string}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  payloadCloudPlugin(),
]
