// 검증 스크립트 — 금이 간 목걸이 ver.A/B/C 실데미지 비교
// 출처: ex-data.md §5/6/7. 실행: node engine/validate-necklace.mjs
//
// ⚠ 모델 메모: 이 데이터엔 합산 공격력(고정×(1+공격력%))이 없고 "최종 공격력"만 있다.
//   최종 공격력 = 합산 × 스킬 공격력%  → 스킬 레벨의 공격력 기여가 이미 반영됨.
//   atkFinal을 스냅샷 비교 모드로 입력 → perLevel 항 자동 OFF (이중계산 방지).
//   (스킬 레벨이 "공격력 외" 스킬 계수에도 영향을 주는지는 이 데이터로 분리 불가 — 2차 효과)

import { realDamage } from "./realDamage.mjs";

const VERSIONS = {
  A: { lv: 74, power: 222904 /*만*/, atkFinal: 5711714, dmg: 225.7, amp: 1.4, statRatio: 102,
       critRate: 68.6, critDmg: 92.6,  bossDmg: 20, normalDmg: 39.5, skillDmg: 20, basicDmg: 27.7,
       finalDmg: 12.2, minMult: 128.6, maxMult: 141.1, skillLevel: 20 },
  B: { lv: 78, power: 221037, atkFinal: 5584257, dmg: 214.5, amp: 1.4, statRatio: 102.7,
       critRate: 68.6, critDmg: 101.2, bossDmg: 20, normalDmg: 39.5, skillDmg: 20, basicDmg: 27.7,
       finalDmg: 12.3, minMult: 128.6, maxMult: 141.1, skillLevel: 23 },
  C: { lv: 75, power: 219575, atkFinal: 5379267, dmg: 225.8, amp: 1.4, statRatio: 102.6,
       critRate: 68.6, critDmg: 101.2, bossDmg: 20, normalDmg: 39.5, skillDmg: 20, basicDmg: 27.7,
       finalDmg: 12.3, minMult: 128.6, maxMult: 141.1, skillLevel: 23 },
};

// atkFinal이 있으므로 스냅샷 비교 모드 자동 적용 (perLevel 항 OFF)
function report(mode, label) {
  console.log(`\n── ${label} ─────────────────────────────`);
  const rows = Object.entries(VERSIONS).map(([k, s]) => ({ k, rd: realDamage(s, mode), power: s.power }));
  const maxRd = Math.max(...rows.map(r => r.rd));
  const maxPw = Math.max(...rows.map(r => r.power));
  // 실데미지 내림차순
  rows.sort((a, b) => b.rd - a.rd);
  console.log("ver | 실데미지        | vs최고  | 전투력(만) | vs최고");
  for (const r of rows) {
    const rdGap = ((r.rd / maxRd - 1) * 100).toFixed(2);
    const pwGap = ((r.power / maxPw - 1) * 100).toFixed(2);
    console.log(
      `${r.k}   | ${Math.round(r.rd).toLocaleString().padStart(14)} | ${rdGap.padStart(6)}% | ${r.power.toLocaleString().padStart(9)} | ${pwGap.padStart(6)}%`
    );
  }
  // 순위 비교
  const rdOrder = rows.map(r => r.k).join(" > ");
  const pwOrder = [...rows].sort((a, b) => b.power - a.power).map(r => r.k).join(" > ");
  console.log(`실데미지 순위: ${rdOrder}   |   전투력 순위: ${pwOrder}   ${rdOrder === pwOrder ? "(일치)" : "⚠ 불일치"}`);
}

console.log("금이 간 목걸이 — ver.A(Lv74) / ver.B(Lv78) / ver.C(Lv75) 실데미지 검증");
report({ boss: true,  skill: true  }, "보스 + 스킬 공격");
report({ boss: false, skill: false }, "일반몹 + 기본 공격");

// 스킬 레벨 차이(A=20, B·C=23)가 결과에 미치는 영향 메모
console.log("\n※ A는 스킬 20레벨, B·C는 23레벨. 최종 공격력에 이미 반영됨 → perLevel 별도 추정 불필요.");
console.log("※ B vs C는 스킬 레벨 동일(23) → 둘 비교는 스킬레벨 모델과 무관하게 정확.");
