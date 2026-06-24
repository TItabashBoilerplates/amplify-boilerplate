// Amplify (React Native) に必要な polyfill。Amplify 初期化より前に読み込む。
import 'react-native-get-random-values'
import { Amplify } from 'aws-amplify'
// 生成物（ampx sandbox / generate outputs）。git 管理しない。
import outputs from '../../../amplify_outputs.json'

/**
 * Amplify をクライアント初期化する（React Native）。
 *
 * アプリ起動時に一度だけ side-effect として import する。
 * `AppProvider` から読み込まれる。
 */
Amplify.configure(outputs)
