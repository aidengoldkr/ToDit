# CORS 이슈 트러블슈팅 핸드오프 (Handoff)

현재 ToDit 서비스의 람다 파서(/parse) 호출 시 발생하는 CORS(`No HTTP ok status`) 에러에 대한 작업 현황 리포트입니다.

## 1. 현재 상태 (Current Status)
- **에러**: `Access to fetch at 'https://ilezavvj6e.execute-api.ap-northeast-2.amazonaws.com/parse' from origin 'http://localhost:5173' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: It does not have HTTP ok status.`
- **증상**: 브라우저의 Preflight(`OPTIONS`) 요청에 대해 API Gateway가 200번대 응답을 주지 못하고 차단되는 상태입니다.
- **특이사항**: 람다 로그가 CloudWatch에 쌓이지 않는 것으로 보아, 요청이 람다에 도달하기 전 **API Gateway 레이어**에서 차단되고 있습니다.

## 2. 지금까지 적용한 해결 방법 (Actions Taken)

### A. 람다 코드 (Lambda Code)
- **동적 CORS 헤더**: `lambda/parse/index.ts`를 수정하여 들어오는 요청의 `Origin` 헤더를 그대로 에코(Echo)하도록 했습니다. (쉼표로 구분된 `ALLOWED_ORIGIN` 환경변수 에러를 원천 차단)
- **핸들러 개선**: API Gateway V1(REST)과 V2(HTTP) 이벤트를 모두 지원하도록 메서드 및 헤더 추출 로직을 유연하게 수정했습니다.

### B. API Gateway (HTTP API - ilezavvj6e)
- **경로(Routes) 추가**: `ANY /parse` 및 `ANY /{proxy+}` 경로를 추가하여 모든 요청이 서비스 람다(`pyylbt4`)로 정확히 연결되도록 했습니다.
- **CORS 설정**: 콘솔 및 CLI를 통해 `http://localhost:5173` 허용, `AllowCredentials: true`, `AllowHeaders: content-type, authorization` 설정을 완료했습니다.
- **스테이지 자동 배포**: `$default` 스테이지의 `AutoDeploy` 설정을 `True`로 활성화하고 수동 배포(`7ukk66`)도 병행했습니다.

### C. 배포 프로세스 (Deployment)
- **이미지 빌드**: 람다 호환을 위해 `docker buildx build --platform linux/amd64 --provenance=false` 명령어로 단일 아키텍처 이미지를 생성했습니다.
- **ECR 푸시 & 업데이트**: `207567793402.dkr.ecr.ap-northeast-2.amazonaws.com/todit-parse` 리포지토리에 푸시하고 `todit-lambda` 함수 코드를 최신 이미지로 업데이트 완료했습니다.

## 3. 남은 의문점 및 해결 제언 (Remaining Questions)
- **API Gateway 캐싱**: 자동 배포 설정에도 불구하고 API Gateway의 실제 작동이 지연되거나 구 버전 설정을 유지하고 있을 가능성이 있습니다.
- **브라우저 환경**: Hydration 에러나 `data-cors-unblock` 속성과 관련된 브라우저 확장 프로그램이 Preflight 단계에서 예기치 않은 간섭을 일으키고 있을 수 있습니다.
- **람다 타임아웃/권한**: 아주 드물게 람다 초기화 중의 권한 문제로 인해 API Gateway 단계에서 즉시 502/403을 내보내며 CORS 헤더를 생략할 수 있습니다.

## 4. 참고 자료
- **REST API ID**: `ilezavvj6e` (Seoul Region - ap-northeast-2)
- **Lambda Name**: `todit-lambda`
- **ECR Repo**: `todit-parse`
