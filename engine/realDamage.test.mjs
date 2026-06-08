// 회귀 테스트 — 무의존성. 실행: node engine/realDamage.test.mjs
// 검증 케이스 출처: _progress/데이터.md §1.2 §6, _progress/스탯-측정.md (2026-06-04)

import { realDamage, totalAttack, compareDamage, calibratePerLevel, statRatioFromMainStat,
         clearTime, huntRate, compareHuntSpeed, overkillThresholdG } from "./realDamage.mjs";
import { BASELINE } from "./baseline.mjs";

let pass = 0;
let fail = 0;

function approx(actual, expected, tol, label) {
  const ok = Math.abs(actual - expected) <= tol;
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${label}`);
  if (!ok) console.log(`        기대 ${expected} ± ${tol}, 실제 ${actual}`);
  ok ? pass++ : fail++;
}

// ── 구버전 스탯 인라인 (2026-06-04 이전 측정값, 델타 입력 모드) ──
// BASELINE이 atkFinal 스냅샷 모드로 전환됨에 따라 구버전 의존 케이스는
// 이 인라인 스탯을 사용 (기존 회귀 보호).
const BASELINE_OLD = {
  atkFlat:    73848,   atkPct:    5397.1,
  dmg:        225.7,   amp:         1.4,   statRatio:  102,
  basicDmg:   27.7,    skillDmg:   20,     bossDmg:    20,    normalDmg: 39.5,
  finalDmg:   12.2,    minMult:   128.6,   maxMult:   141.1,
  critRate:   68.6,    critDmg:   92.6,    skillLevel: 20,    perLevel:   0,
};

// ── 기존 회귀 6개 ────────────────────────────────────────────

// 1) 합산 공격력 = 73,848 × (1 + 5397.1/100) = 4,059,498 (데이터.md §1.2)
approx(totalAttack(BASELINE_OLD), 4059498.4, 1, "합산 공격력 = 4,059,498");

// 2) 어깨장식 교체 (데이터.md §6-2): 고정공격 -258, 나머지 딜 스탯 불변
//    → 실데미지 변화는 고정공격 비율 변화와 동일해야 함 ≈ -0.35%
const shoulder = compareDamage(BASELINE_OLD, { atkFlat: BASELINE_OLD.atkFlat - 258 }, { boss: true, skill: true });
approx(shoulder, 73590 / 73848 - 1, 1e-9, "어깨장식 교체 실데미지 ≈ -0.35% (보스/스킬)");
approx(shoulder, -0.0035, 5e-4, "어깨장식 교체 ≈ -0.35% (핸드오프 실측 일치)");

// 3) 모드별 일관성: 일반 몬스터 모드에서도 고정공격 변화율은 동일
const shoulderNormal = compareDamage(BASELINE_OLD, { atkFlat: BASELINE_OLD.atkFlat - 258 }, { boss: false, skill: false });
approx(shoulderNormal, shoulder, 1e-12, "고정공격 변화율은 모드와 무관");

// 4) perLevel=0이면 스킬 레벨 변화는 실데미지에 영향 없음
const lvlOnly = compareDamage(BASELINE_OLD, { skillLevel: 11 }, { boss: true, skill: true });
approx(lvlOnly, 0, 1e-12, "perLevel=0 → 스킬 레벨 변화 무시 (보정 전 상태)");

// 5) 캘리브레이션 함수 자기검증 (round-trip):
//    perLevel=4로 만든 가상 실측 변화율을 다시 역산하면 4가 나와야 함
const TRUE_P = 4;
const beforeCalib = { ...BASELINE_OLD, perLevel: TRUE_P };
const afterCalib = { ...beforeCalib, atkFlat: beforeCalib.atkFlat + 2711, dmg: beforeCalib.dmg - 11.3, skillLevel: 11 };
const observed = realDamage(afterCalib, { boss: true, skill: true }) / realDamage(beforeCalib, { boss: true, skill: true }) - 1;
const recovered = calibratePerLevel(beforeCalib, afterCalib, observed, { boss: true, skill: true });
approx(recovered, TRUE_P, 1e-6, "calibratePerLevel round-trip → perLevel 복원");

// ── 측정 검증 케이스 (2026-06-04 스탯-측정.md) ───────────────

// 6) 크리 배율: critRate=100, critDmg=100 → crit 항 = 2.0×
//    clean 실측: 240,770,000 / 120,000,000 = 2.006× (크리/일반 타격비 ≈ 1+critDmg/100)
//    ⚠ 코드의 crit 항은 critRate 가중 평균이므로, critRate=100일 때만 = 1+critDmg/100
//    critDmg=100, critRate=100 → 1 + 1.0 × 1.0 = 2.0 (공식 확인)
{
  const s = { ...BASELINE, critRate: 100, critDmg: 100 };
  const base = { ...s };
  const withCrit = realDamage(s, { boss: false, skill: false });
  const noCrit   = realDamage({ ...s, critRate: 0 }, { boss: false, skill: false });
  approx(withCrit / noCrit, 2.0, 1e-9, "크리 배율: critRate=100 critDmg=100 → 2.0×");
}

// 7) 데미지% +4%p → 실데미지 +1.228% (225.8→229.8, 스탯-측정.md 검증)
//    공식: (1+229.8/100)/(1+225.8/100) - 1 = 3.298/3.258 - 1 ≈ +0.01228
{
  const base = { ...BASELINE, dmg: 225.8 };
  const delta = compareDamage(base, { dmg: 229.8 }, { boss: false, skill: false });
  approx(delta, (1 + 229.8 / 100) / (1 + 225.8 / 100) - 1, 1e-9, "데미지% +4%p → +1.228% (비선형 확인)");
  approx(delta, 0.01228, 1e-4, "데미지% +4%p 실측 재현 ≈ +1.228%");
}

// 8) 주스탯 → statRatio 파생: statRatioFromMainStat(10728) ≈ 107.7%
//    계수 0.01004: 10,401×0.01004=104.46≈104.5, 10,728×0.01004=107.71≈107.7 ✅
approx(statRatioFromMainStat(10728), 107.71, 0.1, "statRatioFromMainStat(10728) ≈ 107.7%");
approx(statRatioFromMainStat(10401), 104.47, 0.1, "statRatioFromMainStat(10401) ≈ 104.5%");

// 9) atkFinal 스냅샷 모드: skillLevel·perLevel을 변경해도 결과 불변
{
  const snap = { atkFinal: 5711714, dmg: 225.7, amp: 1.4, statRatio: 102,
                 critRate: 68.6, critDmg: 92.6, bossDmg: 20, normalDmg: 39.5,
                 skillDmg: 20, basicDmg: 27.7, finalDmg: 12.2,
                 minMult: 128.6, maxMult: 141.1, skillLevel: 20, perLevel: 0 };
  const snapHighLv = { ...snap, skillLevel: 30, perLevel: 5 };
  const ratio = realDamage(snapHighLv, { boss: true, skill: true }) / realDamage(snap, { boss: true, skill: true });
  approx(ratio, 1.0, 1e-12, "atkFinal 스냅샷 모드: perLevel 변화가 결과에 영향 없음 (이중계산 방지)");
}

// 10) luckyDiceAvg 옵션: true면 × 1.026 적용
{
  const withLucky  = realDamage(BASELINE, { boss: false, skill: false }, { luckyDiceAvg: true });
  const noLucky    = realDamage(BASELINE, { boss: false, skill: false });
  approx(withLucky / noLucky, 1.026, 1e-9, "luckyDiceAvg=true → × 1.026 적용");
}

// ── 사냥속도 모델 테스트 ──────────────────────────────────────
// atkFinal 스냅샷 모드 기준 스탯 (BASELINE은 이미 atkFinal 모드)
// 일반몹 모드(보스=false, 스킬=true), stageG 없이 방어 미적용 (상대 비교용)

const MODE_NORMAL = { boss: false, skill: true };

// 11) 원킬 상황: dmg +50%p 해도 huntRate 불변 (원킬 유지 → 추가 데미지 0 기여)
//     monsterHP=1 → 어떤 세팅이든 무조건 원킬
{
  const envOverkill = { monsterHP: 1, hitsPerSec: 10, aoeTargets: 1 };
  const biggerDmg = applyDeltaHelper(BASELINE, { dmg: BASELINE.dmg + 50 });
  const rateBase  = huntRate(BASELINE,   MODE_NORMAL, envOverkill);
  const rateAfter = huntRate(biggerDmg,  MODE_NORMAL, envOverkill);
  approx(rateAfter / rateBase, 1.0, 1e-9,
    "원킬 상황: dmg +50%p → huntRate 불변 (원킬 유지)");
}

// 12) 원킬 상황: hitsPerSec ×1.5 → huntRate ×1.5
{
  const envBase  = { monsterHP: 1, hitsPerSec: 10,  aoeTargets: 1 };
  const envFast  = { monsterHP: 1, hitsPerSec: 15,  aoeTargets: 1 };
  const rateBase = huntRate(BASELINE, MODE_NORMAL, envBase);
  const rateFast = huntRate(BASELINE, MODE_NORMAL, envFast);
  approx(rateFast / rateBase, 1.5, 1e-9,
    "원킬 상황: hitsPerSec ×1.5 → huntRate ×1.5");
}

// 13) 비원킬 상황: 데미지 대폭 증가 → clearTime 감소(huntRate 증가)
//     monsterHP=1e12 → 절대 원킬 불가 구간. dmg +100%p 시 clearTime 단축 확인.
{
  const envNoOverkill = { monsterHP: 1e12, hitsPerSec: 10, aoeTargets: 1 };
  const biggerDmg = applyDeltaHelper(BASELINE, { dmg: BASELINE.dmg + 100 });
  const ctBase    = clearTime(BASELINE,   MODE_NORMAL, envNoOverkill);
  const ctAfter   = clearTime(biggerDmg,  MODE_NORMAL, envNoOverkill);
  const ok = ctAfter < ctBase;
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  비원킬 상황: dmg +100%p → clearTime 감소`);
  if (!ok) console.log(`        ctBase=${ctBase}, ctAfter=${ctAfter}`);
  ok ? pass++ : fail++;
}

// ── 내부 헬퍼: BASELINE에 델타 적용 (테스트용 래퍼) ────────────
function applyDeltaHelper(base, delta) {
  return { ...base, ...delta };
}

// ── 결과 ──────────────────────────────────────────────────────
console.log(`\n${fail === 0 ? "🟢" : "🔴"} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
