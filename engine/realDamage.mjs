// 메이플 키우기 — 실데미지 계산 엔진
// 모든 % 인자는 인게임 정보창 표시값 그대로. 항목은 전부 곱연산.
// 비교 기준: realDamage(변경안) / realDamage(현재) - 1 = 실데미지 변화율
// 근거 공식: _progress/데이터.md §1

// ── 스탯 스키마 ───────────────────────────────────────────────
// atkFlat     고정 공격력 합 (+)
// atkPct      공격력 % 합
// dmg         데미지 %
// amp         데미지 증폭 %
// statRatio   스탯 비례 데미지 %
// critRate    크리티컬 확률 %
// critDmg     크리티컬 데미지 %
// bossDmg     보스 몬스터 데미지 %
// normalDmg   일반 몬스터 데미지 %
// skillDmg    스킬 데미지 %
// basicDmg    기본 공격 데미지 %
// finalDmg    최종 데미지 %
// minMult     최소 데미지 배율 %
// maxMult     최대 데미지 배율 %
// skillLevel  3차 스킬 레벨 (정수)
// perLevel    스킬 레벨당 데미지 % (⚠ 게임 내부 계수 미상 → 캘리브레이션 필요, 기본 0)

// ── 합산 공격력 (파생) ────────────────────────────────────────
// 검증: 73,848 × (1 + 5397.1/100) = 4,059,498  ← 인게임 합산과 일치
export function totalAttack(s) {
  return s.atkFlat * (1 + s.atkPct / 100);
}

// ── 실데미지 (상대 비교용 단일 타격 기대값) ───────────────────
// mode = { boss: bool, skill: bool }
export function realDamage(s, mode) {
  const atk      = totalAttack(s);
  const crit     = 1 + (s.critRate / 100) * (s.critDmg / 100);   // 평균 크리 배율
  const target   = mode.boss  ? (1 + s.bossDmg  / 100) : (1 + s.normalDmg / 100);
  const atype     = mode.skill ? (1 + s.skillDmg / 100) : (1 + s.basicDmg  / 100);
  const dmgRange = ((s.minMult + s.maxMult) / 2) / 100;          // 최소~최대 평균 배율
  const skillLv  = 1 + s.skillLevel * (s.perLevel / 100);

  return atk
    * (1 + s.dmg       / 100)   // 데미지
    * (1 + s.amp       / 100)   // 데미지 증폭
    * (1 + s.statRatio / 100)   // 스탯 비례 데미지
    * crit                      // 크리티컬
    * target                    // 보스/일반 몬스터 데미지
    * atype                     // 스킬/기본 공격 데미지
    * (1 + s.finalDmg  / 100)   // 최종 데미지
    * dmgRange                  // 최소~최대 데미지 배율(평균)
    * skillLv;                  // 스킬 레벨
}

// ── 델타 적용: 바꿀 것만 덮어쓴 새 스탯 반환 ──────────────────
export function applyDelta(base, delta) {
  return { ...base, ...delta };
}

// ── 비교: 변경안 대비 실데미지 변화율 (예: -0.0035 = -0.35%) ──
export function compareDamage(base, delta, mode) {
  const after = applyDelta(base, delta);
  return realDamage(after, mode) / realDamage(base, mode) - 1;
}

// ── perLevel 캘리브레이션 ─────────────────────────────────────
// before/after 두 스탯과 인게임에서 실측한 "실데미지 변화율"(observedRatio,
// 예: -0.05)을 주면 스킬 레벨당 % 계수(perLevel)를 역산한다.
// 유도: R = K · (1 + b·x)/(1 + a·x),  x = perLevel/100
//   K = (skillLevel 항 제외) 실데미지 비, a = before.skillLevel, b = after.skillLevel
//   → x = (m-1)/(b - m·a),  m = (1+R)/K
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
