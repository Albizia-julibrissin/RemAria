# クエスト完了・報告フロー（B 案）

## 方針

- **条件を満たしてもその場では「完了」にしない。**
- **「クリア報告」を押したタイミングで**  
  **報酬付与**（GRA・研究記録書・アイテム）と**次のクエスト出現**の両方を行う。

## 実装の対応

| 処理 | 内容 |
|------|------|
| addQuestProgress* | 進捗加算のみ。progress ≥ 目標になっても state は "in_progress" のまま。unlockNextQuests は呼ばない。 |
| acknowledgeQuestReport | **報告押下時**に、state が "in_progress" かつ progress ≥ 目標なら → 完了・reportAcknowledgedAt をセットし、**grantQuestRewards**（GRA・研究記録書・アイテム付与）→ unlockNextQuests。返却で報酬内容を返し、モーダルで「報酬を受け取った。」と一覧表示。 |
| UI | 「報告待ち」は progress ≥ targetCount かつ未報告で判定。「クリア報告」ボタンも同条件。報告確認後は報酬一覧（〇〇 GRA・研究記録書〇〇枚・アイテム名 N個）を表示。 |

## 報酬付与（実装済み）

- **Quest.rewardGra** → User.premiumCurrencyFreeBalance に加算。CurrencyTransaction に reason: "quest_reward" で記録。
- **Quest.rewardResearchPoint** → User.researchPoint に加算。表示名は「研究記録書」。
- **Quest.rewardItems**（JSON 配列 `[{ itemId, amount }, ...]`）→ grantStackableItem で UserInventory に加算。
- 正本: `spec/054_quests.md`。
