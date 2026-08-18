// TypeScript 6 から、副作用 import（`import '../global.css'`）に対しても
// モジュール宣言が必須になった（TS2882: Cannot find module or type declarations
// for side-effect import）。
//
// Web 側は Next.js が生成する `next-env.d.ts` の `/// <reference types="next" />`
// が `*.css` を宣言してくれるが、Expo にはこれに相当するものが無い。
// NativeWind v5 / react-native-css の型（nativewind-env.d.ts）も CSS モジュール自体は
// 宣言しないため、ここで明示する。
//
// CSS は Metro の NativeWind トランスフォーマが処理するので、値としての型は不要。
declare module '*.css' {}
