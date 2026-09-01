import { createGateway } from '@ai-sdk/gateway'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel, ToolSet } from 'ai'

/**
 * `generateText` reports only the *final* step's text. A search-heavy run that
 * ends on a tool call therefore returns `text: ''` even though it gathered
 * plenty — fall back to everything the model wrote along the way.
 */
export function findingsFrom(result: {
  text: string
  steps: ReadonlyArray<{ text: string }>
}): string {
  const final = result.text.trim()
  if (final) return final
  return result.steps
    .map((step) => step.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

import { aiCredentials, scoutModelId } from './env'

export type Brain = {
  /** Model wired for live web research. */
  searchModel: LanguageModel
  /** Tools the research model may call. Empty on OpenRouter — search is a provider plugin. */
  searchTools: ToolSet
  /**
   * True when the provider injects search results into the prompt itself rather
   * than exposing a tool the model must choose to call. That distinction decides
   * whether searching and returning a schema can happen in one request: with
   * provider-side search it can, because there is no tool loop for the schema to
   * short-circuit.
   */
  searchIsProviderSide: boolean
  /** Plain model for synthesis and structured output, no search. */
  model: LanguageModel
}

let cached: Brain | null = null

export function brain(): Brain {
  if (cached) return cached

  const { provider, apiKey } = aiCredentials()
  const modelId = scoutModelId()

  if (provider === 'openrouter') {
    const openrouter = createOpenRouter({ apiKey })
    cached = {
      // OpenRouter runs the search itself and folds results into the prompt,
      // so the model needs no tool to reach the web.
      searchModel: openrouter(modelId, {
        plugins: [{ id: 'web', max_results: 8 }, { id: 'response-healing' }],
      }),
      searchTools: {},
      searchIsProviderSide: true,
      model: openrouter(modelId, { plugins: [{ id: 'response-healing' }] }),
    }
    return cached
  }

  const gateway = createGateway({ apiKey })
  cached = {
    searchModel: gateway(modelId),
    // Executed by the Gateway itself, so it works regardless of the model.
    searchTools: { web_search: gateway.tools.perplexitySearch({ maxResults: 8 }) },
    searchIsProviderSide: false,
    model: gateway(modelId),
  }
  return cached
}
