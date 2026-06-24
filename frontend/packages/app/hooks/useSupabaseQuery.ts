/**
 * Supabaseデータフェッチ用共有フック
 *
 * Web/Native間で共有されるデータ取得ロジック
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * クエリの状態
 */
export interface QueryState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
}

/**
 * Supabaseクエリ用フック
 *
 * @param queryFn - Supabaseクエリを実行する関数
 * @param deps - 依存配列（クエリを再実行するトリガー）
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useSupabaseQuery(
 *   async () => {
 *     const { data, error } = await supabase.from('users').select('*')
 *     if (error) throw error
 *     return data
 *   },
 *   [userId]
 * )
 * ```
 */
export function useSupabaseQuery<T>(queryFn: () => Promise<T>, deps: readonly unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    isLoading: true,
    error: null,
  })

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const data = await queryFn()
      setState({ data, isLoading: false, error: null })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }))
    }
  }, [queryFn])

  useEffect(() => {
    execute()
  }, deps)

  const refetch = useCallback(() => {
    execute()
  }, [execute])

  return {
    ...state,
    refetch,
  }
}

/**
 * Supabaseミューテーション用フック
 *
 * @example
 * ```tsx
 * const { mutate, isLoading, error } = useSupabaseMutation(
 *   async (newUser: NewUser) => {
 *     const { data, error } = await supabase.from('users').insert(newUser)
 *     if (error) throw error
 *     return data
 *   }
 * )
 *
 * const handleSubmit = async (data: NewUser) => {
 *   const result = await mutate(data)
 *   if (result.success) {
 *     // Success handling
 *   }
 * }
 * ```
 */
export function useSupabaseMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  const [state, setState] = useState<{
    isLoading: boolean
    error: string | null
  }>({
    isLoading: false,
    error: null,
  })

  const mutate = useCallback(
    async (variables: TVariables) => {
      setState({ isLoading: true, error: null })

      try {
        const data = await mutationFn(variables)
        setState({ isLoading: false, error: null })
        return { success: true as const, data, error: null }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        setState({ isLoading: false, error: errorMessage })
        return { success: false as const, data: null, error: errorMessage }
      }
    },
    [mutationFn]
  )

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null })
  }, [])

  return {
    ...state,
    mutate,
    reset,
  }
}
