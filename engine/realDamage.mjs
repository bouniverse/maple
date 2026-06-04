// 메이플 키우기 — 실데미지 계산 엔진 (통합 리팩터링 2026-06-04)
// 모든 % 인자는 인게임 정보창 표시값 그대로. 항목은 전부 곱연산.
// 비교 기준: realDamage(변경안) / realDamage(현재) - 1 = 실데미지 변화율
// 근거 공식: _progress/데이터.md §1, _progress/스탯-측정.md (2026-06-04 측정)

// ── 스탯 스키마 ───────────────────────────────────────────────
// [입력 이원화] atkFinal이 있으면 스냅샷 비교 모드, 없으면 델타 입력 모드.
//
// 공통 입력:
// dmg         데미지 %
// amp         데미지 증폭 %
// statRatio   스탯 비례 데미지 %  (헬퍼 statRatioFromMainStat로 주스탯에서 파생 가능)
// critRate    크리티컬 확률 %
// critDmg     크리티컬 데미지 %
// bossDmg     보스 몬스터 데미지 %
// normalDmg   일반 몬스터 데미지 %
// skillDmg    스킬 데미지 %
// basicDmg    기본 공격 데미지 %
// finalDmg    최종 데미지 %
// minMult     최소 데미지 배율 %
// maxMult     최대 데미지 배율 %
//
// [스냅샷 비교 모드] atkFinal 제공 시:
// atkFinal    캐릭터창 최종 공격력 (그 값을 공격력으로 직접 사용)
//             → perLevel 항 OFF (스킬레벨 기여가 이미 포함된 값이므로 이중계산 방지)
//
// [델타 입력 모드] atkFinal 미제공 시:
// atkFlat     고정 공격력 합 (+)
// atkPct      공격력 % 합
// skillLevel  3차 스킬 레벨 (정수)
// perLevel    스킬 레벨당 데미지 % (⚠ 게임 내부 계수 미상 → 캘리브레이션 필요, 기본 0)
//             [미보정] 측정 미완료. calibratePerLevel로 역산 가능.

// ── 측정 확정 상수 (2026-06-04 스탯-측정.md) ─────────────────
// 크리 배율: 1 + (critRate/100)×(critDmg/100)
//   clean 기본공격 실측: 240,770,000 / 120,000,000 = 2.006×
//   critDmg=100% → 공식값 2.0× → 검증 성공 ✅
//
// 스탯 비례 데미지 계수: statRatioFromMainStat(mainStat) ≈ mainStat × 0.01004
//   검증: 10,401 × 0.01004 = 104.46% ≈ 104.5% ✅
//          10,728 × 0.01004 = 107.71% ≈ 107.7% ✅
//   (근사: 주스탯 ÷ 100 — 코드는 0.01004 사용, 오차 ≈ 0.04%p)
//
// 주스탯 → 공격력 변환계수: DEX 1 ≈ 공격력 +92.3 [가설, DEX +327→공격력+30,172 기준]
//   (어빌리티 명목 +300 / 실제 DEX +327 — 차이 27은 주스탯 %증폭 추정 [가설])
//
// 데미지% 한계 기여 (225.8% 기준): 1%p당 실데미지 ≈ +0.307% — 비선형
//   검증: 225.8→229.8(+4%p) → 3.298/3.258 = +1.228% ✅
//
// 무기 장착효과 증가: 레벨당 약 +8.6%p 선형 (Lv.2→3: +8.6, Lv.3→4: +8.4, Lv.4→5: +8.8)
//
// 럭키 다이스 (패시브): 고정분 +25.5% + 변동분 0~6.3% (7초 주기)
//   [확정 2026-06-04] 변동분도 캐릭터창 공격력에 반영됨 (660~690만 범위로 7초마다 출렁).
//   → 측정용 공격력은 변동분 0(관측 최소값) 기준으로 입력한다.
//   기댓값 옵션 luckyDiceAvg=true 시 × 1.026 적용 (변동분0 베이스에 평균을 곱해 평소 기대 딜 산출)
//     (변동분 시간가중 평균: 5초등장/7초주기 × 등장 중 평균 3.675% ≈ +2.6% [가설])

// ── 헬퍼: 주스탯 → 스탯 비례 데미지(%) 파생 ──────────────────
// statRatio 입력 없이 주스탯 수치만 있을 때 사용.
// 계수 0.01004: 10401→104.5%, 10728→107.7% 실측 검증 (2026-06-04).
// (근사 ÷100 은 오차 0.42%p — 정확도가 필요하면 0.01004 유지)
export function statRatioFromMainStat(mainStat) {
  return mainStat * 0.01004;
}

// ── 헬퍼: 주스탯 → 공격력 추가량 추정 [가설] ────────────────
// DEX +327 → 공격력 +30,172 실측 기준: 1 DEX ≈ +92.3 공격력.
// [가설] 어빌리티 명목 +300 vs 실제 +327 차이(주스탯 %증폭 추정)로 불확실성 있음.
export function atkFromDex(dexDelta) {
  return dexDelta * 92.3; // [가설, +327 측정 기준]
}

// ── 합산 공격력 (델타 입력 모드용 파생) ─────────────────────
// 검증: 73,848 × (1 + 5397.1/100) = 4,059,498  ← 인게임 합산과 일치
export function totalAttack(s) {
  return s.atkFlat * (1 + s.atkPct / 100);
}

// ── 실데미지 (상대 비교용 단일 타격 기대값) ───────────────────
// mode    = { boss: bool, skill: bool }
// options = { luckyDiceAvg?: bool }  기댓값 계산 시 럭키 다이스 변동분 반영
//
// 공격력 입력 이원화 (⚠ 이중계산 방지):
//   s.atkFinal != null → 스냅샷 비교 모드: atkFinal을 직접 사용, perLevel 항 OFF
//   s.atkFinal == null → 델타 입력 모드: totalAttack(s) 파생, perLevel 항 ON
//
// 곱셈 순서 (검증된 구조):
//   atk × dmg × amp × statRatio × crit × target × atype × finalDmg × dmgRange
//   [× perLevel항(델타모드만)] [× 1.026(luckyDiceAvg 옵션)]
export function realDamage(s, mode, options = {}) {
  const snapshotMode = s.atkFinal != null;  // != null → 0도 스냅샷 모드
  const atk      = snapshotMode ? s.atkFinal : totalAttack(s);

  // 크리티컬: 평균 크리 배율 = 1 + (critRate/100)×(critDmg/100)
  // 검증: critDmg=100% → crit=2.0× → clean 실측 2.006× ✅
  const crit     = 1 + (s.critRate / 100) * (s.critDmg / 100);
  const target   = mode.boss  ? (1 + s.bossDmg  / 100) : (1 + s.normalDmg / 100);
  const atype    = mode.skill ? (1 + s.skillDmg / 100) : (1 + s.basicDmg  / 100);
  const dmgRange = ((s.minMult + s.maxMult) / 2) / 100;  // 최소~최대 평균 배율

  // 스킬레벨 항: 델타 모드만 적용. 스냅샷 모드에서는 이미 atkFinal에 반영됨.
  // [미보정] perLevel 계수는 측정 미완료 → calibratePerLevel로 역산 가능.
  const skillLv  = snapshotMode ? 1 : 1 + s.skillLevel * (s.perLevel / 100);

  // 럭키 다이스 변동분 기댓값 옵션 (시간가중 평균 +2.6% [가설])
  const lucky    = options.luckyDiceAvg ? 1.026 : 1;

  return atk
    * (1 + s.dmg       / 100)   // 데미지
    * (1 + s.amp       / 100)   // 데미지 증폭
    * (1 + s.statRatio / 100)   // 스탯 비례 데미지
    * crit                      // 크리티컬 (평균 배율)
    * target                    // 보스/일반 몬스터 데미지
    * atype                     // 스킬/기본 공격 데미지
    * (1 + s.finalDmg  / 100)   // 최종 데미지
    * dmgRange                  // 최소~최대 데미지 배율(평균)
    * skillLv                   // 스킬 레벨 [델타 모드만, 미보정]
    * lucky;                    // 럭키 다이스 변동분 기댓값 [옵션]
}

// ── 델타 적용: 바꿀 것만 덮어쓴 새 스탯 반환 ──────────────────
export function applyDelta(base, delta) {
  return { ...base, ...delta };
}

// ── 비교: 변경안 대비 실데미지 변화율 (예: -0.0035 = -0.35%) ──
export function compareDamage(base, delta, mode, options = {}) {
  const after = applyDelta(base, delta);
  return realDamage(after, mode, options) / realDamage(base, mode, options) - 1;
}

// ── perLevel 캘리브레이션 ─────────────────────────────────────
// before/after 두 스탯과 인게임에서 실측한 "실데미지 변화율"(observedRatio,
// 예: -0.05)을 주면 스킬 레벨당 % 계수(perLevel)를 역산한다.
// 유도: R = K · (1 + b·x)/(1 + a·x),  x = perLevel/100
//   K = (skillLevel 항 제외) 실데미지 비, a = before.skillLevel, b = after.skillLevel
//   → x = (m-1)/(b - m·a),  m = (1+R)/K
// ⚠ 델타 입력 모드 전용. atkFinal이 있으면 skillLv 항이 비활성 → 역산 불가.
export function calibratePerLevel(before, after, observedRatio, mode) {
  const zero = (s) => ({ ...s, perLevel: 0, skillLevel: 0 }); // 스킬레벨 항 제거
  const K = realDamage(zero(after), mode) / realDamage(zero(before), mode);
  const m = (1 + observedRatio) / K;
  const a = before.skillLevel;
  const b = after.skillLevel;
  const denom = b - m * a;
  if (Math.abs(denom) < 1e-12) return null; // 역산 불가 (스킬레벨 변화 없음 등)
  const x = (m - 1) / denom;
  return x * 100; // perLevel %
}
