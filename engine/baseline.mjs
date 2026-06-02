// 유저 현재 캐릭터 스탯 (기본값 / 테스트 데이터)
// 직업: 캡틴 (주스탯 DEX → DEX 1당 공1, 부스탯 STR → STR 4당 공1)
// 출처: _progress/데이터.md §2

export const BASELINE = {
  atkFlat:    73848,    // 고정 공격력 합 (+)
  atkPct:     5397.1,   // 공격력 % 합
  dmg:        225.7,    // 데미지
  amp:        1.4,      // 데미지 증폭
  statRatio:  102,      // 스탯 비례 데미지
  basicDmg:   27.7,     // 기본 공격 데미지
  skillDmg:   20,       // 스킬 데미지
  bossDmg:    20,       // 보스 몬스터 데미지
  normalDmg:  39.5,     // 일반 몬스터 데미지
  finalDmg:   12.2,     // 최종 데미지
  minMult:    128.6,    // 최소 데미지 배율
  maxMult:    141.1,    // 최대 데미지 배율
  critRate:   68.6,     // 크리티컬 확률
  critDmg:    92.6,     // 크리티컬 데미지
  skillLevel: 20,       // 3차 스킬 레벨
  perLevel:   0,        // ⚠ 스킬 레벨당 % — 미정, 캘리브레이션 전까지 0
};

// 참고용 (실데미지 비교엔 미사용): 전투력 22억 2904만, 최종 공격력 5,711,714
