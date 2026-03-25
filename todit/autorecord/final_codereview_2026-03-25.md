# ToDit Final Code Review (2026-03-25)

대상: `c:\project\Insight_Paser\ToDit\todit`

빌드 확인:

- `cmd /c npm run build` 통과

판단:

- 현재 기준으로 새로운 `P1` 이슈는 확인되지 않았습니다.
- 남아 있는 주요 리스크는 요청하신 세 가지 `P2` 이슈와 로컬 환경 정리 항목입니다.

## Findings

### P2. 미인증 계정 재가입 요청이 비밀번호 변경처럼 보이지만 실제로는 기존 비밀번호를 유지한 채 인증 메일만 재발송됨

현재 `signup` API는 이미 존재하는 미인증 `credentials` 계정에 대해, 새 `password`와 `name`을 무시하고 토큰만 새로 발급해 메일을 다시 보냅니다. 사용자는 새 비밀번호로 다시 가입했다고 생각할 수 있지만, 실제 로그인에는 예전 비밀번호가 그대로 남습니다. 계정 복구 UX가 오해를 유발하고, 잘못된 비밀번호로 계속 로그인 실패하는 상태를 만들 수 있습니다.

근거:

- [route.ts](c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts#L31)
- [route.ts](c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts#L39)
- [route.ts](c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts#L67)

권장 방향:

- `signup`은 신규 가입 전용으로 제한
- 미인증 계정 재발송은 별도 endpoint로 분리
- UI 문구도 “기존 계정의 정보는 변경되지 않습니다”로 명시

### P2. `PATCH /api/todo/[id]`가 여전히 strict reject validator가 아니라 permissive normalizer를 사용해 malformed plan을 조용히 저장할 수 있음

`PATCH`는 이제 `validateActionPlan()`를 거치지만, 이 함수는 엄격한 거절 validator가 아니라 normalization 함수입니다. 예를 들어 `task`가 없는 action도 빈 문자열로 저장되고, 누락된 `due`는 fallback 날짜로 채워집니다. 즉 깨진 payload를 400으로 차단하지 않고 “그럴듯한 데이터”로 저장할 수 있어 API 계약이 여전히 느슨합니다.

근거:

- [route.ts](c:\project\Insight_Paser\ToDit\todit\src\app\api\todo\[id]\route.ts#L100)
- [route.ts](c:\project\Insight_Paser\ToDit\todit\src\app\api\todo\[id]\route.ts#L105)
- [schema.ts](c:\project\Insight_Paser\ToDit\todit\src\lib\schema.ts#L25)
- [schema.ts](c:\project\Insight_Paser\ToDit\todit\src\lib\schema.ts#L28)
- [schema.ts](c:\project\Insight_Paser\ToDit\todit\src\lib\schema.ts#L43)

권장 방향:

- OpenAI 후처리용 `validateActionPlan()` 유지
- API 입력 전용 strict schema를 별도 추가
- `task` 빈 문자열, 잘못된 `priority`, 잘못된 `due`, unknown field는 400으로 즉시 거절

### P2. 미인증 계정 이메일로 누구나 반복 요청하면 인증 메일을 계속 재발송할 수 있어 스팸/열거 위험이 남음

현재 `signup` API는 미인증 이메일 계정이 있으면 토큰을 새로 발급하고 인증 메일을 다시 보냅니다. 이 경로에는 cooldown, rate limit, CAPTCHA가 없습니다. 제3자가 특정 이메일에 대해 반복 호출로 메일을 계속 보낼 수 있고, 응답 차이를 통해 미인증 계정 존재 여부도 추정할 수 있습니다.

근거:

- [route.ts](c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts#L31)
- [route.ts](c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts#L46)
- [route.ts](c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts#L67)

권장 방향:

- `POST /api/auth/resend-verification` 분리
- 이메일별 cooldown 추가
- 외부 응답은 generic success로 통일
- 메일 발송 실패 시 기존 토큰 rollback

### P2. 로컬 환경에 사용하지 않는 PortOne 결제 변수가 그대로 남아 있음

코드 기준으로 결제는 제거됐지만, 로컬 `.env.local`에는 PortOne 관련 값이 여전히 존재합니다. 지금은 런타임에서 쓰지 않더라도, 실제 키가 살아 있으면 회전 누락과 노출 관리 부담이 남습니다.

근거:

- [.env.local](c:\project\Insight_Paser\ToDit\todit\.env.local#L33)
- [.env.local](c:\project\Insight_Paser\ToDit\todit\.env.local#L34)
- [.env.local](c:\project\Insight_Paser\ToDit\todit\.env.local#L35)

권장 방향:

- 사용하지 않는 결제 env 제거
- 기존 PortOne 키 rotation

## Residual Notes

- `parse`, `upload-url`, `consent`, quota reservation, build stability는 현재 기준으로 반영되어 있습니다.
- 남은 핵심 작업은 “회원가입/재발송 경로 분리”와 “todo PATCH strict validator 도입”입니다.
