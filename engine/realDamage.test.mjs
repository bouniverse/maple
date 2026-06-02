// 회귀 테스트 — 무의존성. 실행: node engine/realDamage.test.mjs
// 검증 케이스 출처: _progress/데이터.md §1.2, §6

import { realDamage, totalAttack, compareDamage, calibratePerLevel } from "./realDamage.mjs";
import { BASELINE } from "./baseline.mjs";

let pass = 0;
let fail = 0;

function approx(actual, expected, tol, label) {
  const ok = Math.abs(actual - expected) <= tol;
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${label}`);
  if (!ok) console.log(`        기대 ${expected} ± ${tol}, 실제 ${actual}`);
  ok ? pass++ : fail++;
}

// ── 1) 합산 공격력 = 73,848 × (1 + 5397.1/100) = 4,059,498 (데이터.md §1.2)
approx(totalAttack(BASELINE), 4059498.4, 1, "합산 공격력 = 4,059,498");

// ── 2) 어깨장식 교체 (데이터.md §6-2): 고정공격 -258, 나머지 딜 스탯 불변
//      → 실데미지 변화는 고정공격 비율 변화와 동일해야 함 ≈ -0.35%
const shoulder = compareDamage(BASELINE, { atkFlat: BASELINE.atkFlat - 258 }, { boss: true, skill: true });
approx(shoulder, 73590 / 73848 - 1, 1e-9, "어깨장식 교체 실데미지 ≈ -0.35% (보스/스킬)");
approx(shoulder, -0.0035, 5e-4, "어깨장식 교체 ≈ -0.35% (핸드오프 실측 일치)");

// ── 3) 모드별 일관성: 일반 몬스터 모드에서도 고정공격 변화율은 동일
const shoulderNormal = compareDamage(BASELINE, { atkFlat: BASELINE.atkFlat - 258 }, { boss: false, skill: false });
approx(shoulderNormal, shoulder, 1e-12, "고정공격 변화율은 모드와 무관");

// ── 4) perLevel=0이면 스킬 레벨 변화는 실데미지에 영향 없음
const lvlOnly = compareDamage(BASELINE, { skillLevel: 11 }, { boss: true, skill: true });
approx(lvlOnly, 0, 1e-12, "perLevel=0 → 스킬 레벨 변화 무시 (보정 전 상태)");

// ── 5) 캘리브레이션 함수 자기검증 (round-trip):
//      perLevel=4로 만든 가상 실측 변화율을 다시 역산하면 4가 나와야 함
const TRUE_P = 4;
const before = { ...BASELINE, perLevel: TRUE_P };
const after = { ...before, atkFlat: before.atkFlat + 2711, dmg: before.dmg - 11.3, skillLevel: 11 };
const observed = realDamage(after, { boss: true, skill: true }) / realDamage(before, { boss: true, skill: true }) - 1;
const recovered = calibratePerLevel(before, after, observed, { boss: true, skill: true });
approx(recovered, TRUE_P, 1e-6, "calibratePerLevel round-trip → perLevel 복원");

// ── 결과 ──────────────────────────────────────────────────────
console.log(`\n${fail === 0 ? "🟢" : "🔴"} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
