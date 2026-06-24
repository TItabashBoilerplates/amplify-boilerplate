# AI ネイティブサービス デザインパターン集（完全ドメイン非依存版）

本ドキュメントは、AnimAgents 型の思想（多段階成果物・ブロック/ボード中心・人間介在・分岐/影響・局所再生成・可観測性）を、**特定ドメインに依存しない**形で抽象化した **AI ネイティブ（Agentic）サービスのデザインパターン集**です。

対象：

- クリエイティブ制作（漫画/動画/ゲーム/広告）
- ビジネス成果物（提案書/要件定義/設計書/レポート/分析）
- オペレーション（調査 → 判断 → 実行 → 監査）

本書は「UI/UX」「エージェント協調」「データモデル」「実行基盤」「品質・安全」を一貫して扱います。

---

## 0. このパターン集が解く問題

AI エージェントサービスで典型的に起きる失敗は、

- 修正で全崩壊（ウォーターフォール事故）
- 意図の誤推定（LLM が勝手に別工程を触る）
- 実行がブラックボックス（何が起きたか分からない）
- 長時間処理が壊れる（中断/再開/再試行がない）
- 履歴が残らない（比較・説明責任が取れない）

です。

本書のパターンは、これらを **設計レベルで潰す** ためのものです。

---

## 1. 共通語彙（ドメイン非依存）

- **Artifact（成果物）**：ユーザーが価値を感じるアウトプット（文書、コード、画像、動画、スプレッドシート、設計、データなど）
- **Stage（工程）**：Artifact を作るための段階（例：Ideate→Structure→Draft→Refine→Validate→Deliver）
- **Block（ブロック）**：各 Stage の中間成果物単位（UI 上のカード/要素/タイル）
- **Sub-artifact（部分成果物）**：Artifact の一部分（段落、行、セル、レイヤー、タイムレンジ、要素）
- **Selection（選択範囲）**：ユーザーが指定する編集スコープ（どこを変えるか）
- **Intent（意図）**：ユーザーが何をしたいか（生成、修正、比較、分岐、固定、検証、出力）
- **Plan（計画）**：エージェントが実行するステップの構造化表現（HITL のレビュー対象）
- **Run（実行）**：Plan に基づいて行われる処理単位（ログ・再試行の単位）
- **Branch（分岐）**：探索・やり直しのための並行世界（上書きしない）
- **Impact（影響）**：上流変更が下流へ波及する関係（理由付き）
- **Canon（正）**：採用・固定された設定/資産（以降必ず参照される）

---

## 2. コア原則（絶対に崩さない）

### 原則 A：Artifact 中心（Chat 中心にしない）

- UI の主役は **Artifact と Block**
- チャットは補助（補足指示、Plan 編集、理由確認）

### 原則 B：Intent は UI が確定し、Agent は Plan/Execution に集中

- Intent 分類を LLM に任せない
- UI 操作（ボタン/メニュー/選択）で意図を確定

### 原則 C：Plan→ 承認 → 実行（Human-in-the-loop）

- 高コスト・高リスク処理ほどチェックポイント必須
- approve/edit/reject の 3 操作を設計に入れる

### 原則 D：上書きしない。分岐し、差分と影響を見せる

- 更新は versioned
- 上流変更は Impact を作り、Rebuild 選択肢を提示

### 原則 E：局所再生成がデフォルト

- Selection に基づく部分更新
- 全体再生成は最後の手段

### 原則 F：可観測性と回復導線がプロダクトの一部

- 進捗、ログ、失敗理由、再試行、巻き戻しを UI に統合

---

## 3. パターン一覧（カテゴリ別）

- UX/情報設計（P-UX）
- エージェント協調（P-AG）
- データモデル（P-DM）
- 実行基盤（P-RUN）
- 品質/安全（P-QA）

各パターンは次のテンプレで記述します：

- **Intent**：ユーザーの意図
- **Problem**：解く問題
- **Solution**：設計解
- **UI**：画面/コンポーネント
- **Data**：必要なデータ
- **Agent**：エージェントの役割
- **Run**：実行フロー
- **Failure/Recovery**：失敗時の挙動
- **Anti-pattern**：やってはいけない

---

# 4. UX/情報設計パターン（P-UX）

## P-UX-01 Stage Boards（工程別ボード）

- Intent：工程の切替/俯瞰/比較
- Problem：1 画面/1 チャットに混在すると追跡不能
- Solution：Stage ごとに専用ボードを用意し Block を配置
- UI：StageNav（進捗 ✔/▶/⚠）、Board、BlockCard
- Data：Block.stage、Block.state
- Agent：stage-aware（今の工程に合わせた提案）
- Anti-pattern：工程の境界がない UI

## P-UX-02 Artifact-Centric Canvas（成果物中心キャンバス）

- Intent：直接操作で編集
- Problem：プロンプト編集は再現性が低く疲れる
- Solution：Canvas 上で Sub-artifact を直接編集し、AI は補助
- UI：Canvas、Inspector、SelectionHUD、ActionBar
- Data：Sub-artifact の ID/座標/範囲

## P-UX-03 Selection-First Interaction（選択 → 指示）

- Intent：局所修正
- Problem：範囲が曖昧だと全崩壊
- Solution：先に Selection を確定し、自然言語は補足
- UI：Selection 状態の可視化、Refine ボタン
- Data：selection{type, ids, range}

## P-UX-04 Plan Preview + Checkpoint（計画プレビューと承認）

- Intent：安全に実行
- Problem：誤爆、コスト爆発
- Solution：Plan を表示し approve/edit/reject を提供
- UI：RightPane（Plan）、Approve/Edit/Reject
- Data：Plan{objective, steps, scope, expected_changes, risk}

## P-UX-05 Branch as First-Class UI（分岐が一級市民）

- Intent：探索、やり直し
- Problem：上書きは比較不能
- Solution：Branch 作成/切替/比較を UI で提供
- UI：BranchSwitcher、BranchFromHere、Compare
- Data：Branch{parent, createdAt}

## P-UX-06 Impact Map（影響範囲の可視化）

- Intent：上流変更後の判断
- Problem：どこが壊れたか分からない
- Solution：impacted バッジ、理由、Rebuild 選択肢
- UI：ImpactBadge、ImpactPanel、RebuildDialog
- Data：Impact edges（reason 付き）

## P-UX-07 Diff/Compare（差分比較）

- Intent：意思決定
- Problem：探索の比較が困難
- Solution：Split view/ハイライト
- UI：CompareDrawer、DiffViewer
- Data：versioned blocks

## P-UX-08 Proactive Hints（控えめな先回り）

- Intent：次アクション支援
- Problem：割り込み過多は創造性を阻害
- Solution：NextActionCard 程度に留め、強制しない

---

# 5. エージェント協調パターン（P-AG）

## P-AG-01 Intent Resolved by UI（意図は UI で決める）

- Intent：誤爆防止
- Solution：event.type + selection + note をフロントで確定
- Agent：Plan と実行に集中

## P-AG-02 Supervisor + Workers（監督＋専門ワーカー）

- Intent：複雑工程の分業
- Solution：Supervisor が Plan/割当、Worker が狭い責務で実行

## P-AG-03 Tool-First Execution（ツール呼び出し中心）

- Intent：再現性・監査
- Solution：DB/外部 API/Queue を関数化し、Run ログを残す

## P-AG-04 Scope-Limited Regeneration（範囲限定再生成）

- Intent：局所更新
- Solution：Selection を必ず入力に含め、非選択部は固定

## P-AG-05 Critic Loop（批評・品質ループ）

- Intent：品質向上
- Solution：生成 → 評価 →（自動修正 or Issue 化）

## P-AG-06 Rebuild Planning（再ビルド計画提示）

- Intent：上流変更後の復旧
- Solution：Auto/Partial/Cherry-pick/Parallel を Plan で提示

---

# 6. データモデルパターン（P-DM）

## P-DM-01 Versioned Blocks（成果物のバージョン管理）

- Problem：上書きは比較不能
- Solution：Block を versioned にし、新規作成で更新

## P-DM-02 Provenance Graph（由来グラフ）

- Problem：説明できない
- Solution：Block.parent_block_ids で依存関係を保持

## P-DM-03 Impact Edges（影響エッジ）

- Problem：波及の扱いが人力
- Solution：Impact(upstream, downstream, reason)

## P-DM-04 Canon Locks（正の固定）

- Problem：一貫性が崩れる
- Solution：canon 化した資産は以降必ず参照

## P-DM-05 Run Log as Data（実行ログも一次データ）

- Problem：失敗/監査に弱い
- Solution：Run に入力参照/出力参照/ツールログを保存

---

# 7. 実行基盤パターン（P-RUN）

## P-RUN-01 Event-Driven Runs（イベント駆動）

- Solution：UI から決定的なイベントを送る

## P-RUN-02 Unified Subgraph Template（共通テンプレ）

```
ROUTE → LOAD_CONTEXT → MAKE_PLAN → INTERRUPT → DISPATCH → CRITIC → PERSIST → FINALIZE
```

## P-RUN-03 DB is Source of Truth（成果物は DB）

- Solution：成果物は DB/S3、checkpoint は実行状態

## P-RUN-04 Long-running Stages via Queue（長時間はキュー）

- Solution：Graph は enqueue して終了、完了で DB 確定

## P-RUN-05 Recovery & Retry（回復と再試行）

- Solution：worker/tool 単位で retry。Plan は保持

## P-RUN-06 Time Travel = Fork（巻き戻しはフォーク）

- Solution：過去から再開は新 Branch/新 Run として扱う

---

# 8. 品質・安全パターン（P-QA）

## P-QA-01 Quality Gates（品質ゲート）

- Solution：工程ごとの検証ルール（自動修正/Issue 化）

## P-QA-02 Style/Policy Enforcement（ガイド強制）

- Solution：StyleGuide/Policy を参照し、逸脱を検出

## P-QA-03 Auditability（監査可能性）

- Solution：モデル/入力参照/出力参照/意思決定を Run ログへ

---

## 9. ドメイン写像テンプレ（抽象 → 具体へ落とす方法）

このパターン集を任意ドメインへ適用する手順：

1. Artifact を定義する（何が“完成”か）
2. Stage を定義する（完成までの段階）
3. Block を定義する（中間成果物の粒度）
4. Selection を定義する（局所修正の単位）
5. Canon を定義する（固定すべきもの）
6. Quality Gates を定義する（良し悪し）
7. Event.type を固定する（Intent を UI で確定）
8. Rebuild 戦略を定義する（Auto/Partial/Cherry/Parallel）

---

## 10. アンチパターン集（汎用）

- AP-01：チャット 1 本で工程を回す（追跡不能）
- AP-02：intent 推定を LLM に任せる（誤爆）
- AP-03：上書き更新（比較不能・説明不能）
- AP-04：全体再生成がデフォルト（コスト爆発）
- AP-05：成果物を checkpoint だけに置く（復元・共有が弱い）
- AP-06：ログがない（運用不能）

---

## 11. 実装チェックリスト（ドメイン非依存）

### UX

- [ ] Stage Boards がある
- [ ] Canvas/Board で Selection ができる
- [ ] Plan の approve/edit/reject がある
- [ ] Branch/Impact/Diff がある
- [ ] 局所再生成ができる

### Data

- [ ] versioned Blocks
- [ ] Provenance
- [ ] Impact edges
- [ ] Canon locks
- [ ] Run logs

### Run

- [ ] イベント駆動
- [ ] 共通テンプレ
- [ ] 長時間はキュー
- [ ] retry/recovery
- [ ] time travel/fork

---

## 12. 最小 API（参考）

- `POST /agent/runs`：{ project_id, branch_id, event, selection, note }
- `POST /agent/runs/:id/command`：{ approve|edit|reject, plan_patch }
- `GET /runs/:id`：進捗/ログ
- `POST /branches`：分岐作成
- `GET /compare`：差分

---

## 13. まとめ

AI ネイティブサービスの本質は、

- 生成品質そのものではなく
- **修正が怖くない**（局所・分岐・影響）
- **何が起きたか説明できる**（履歴・差分・ログ）
- **人間の意思決定が中心に残る**（Plan/HITL）

という「体験設計」にあります。

このパターン集は、任意ドメインに対して

- Stage/Block/Selection/Event を定義し
- 分岐/影響/差分/品質ゲートを組み込む
  ことで、再現性の高い AI ネイティブ UX を構築できます。
