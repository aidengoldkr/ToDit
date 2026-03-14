# 인증 사용자 기본 라우팅 구현 기록

## 작성일
- 2026-03-13

## 목적
- 인증된 사용자의 기본 진입 경로를 `/dashboard`로 둔다.
- 비로그인 사용자는 `/` 랜딩 페이지를 그대로 본다.
- 비로그인 사용자가 `/dashboard`로 접근하면 `/`로 돌려보낸다.
- 인증된 사용자도 랜딩 페이지를 의도적으로 보려는 경우는 허용한다.

## 적용 파일
- `src/middleware.ts`

## 현재 정책

### 기본 규칙
- 비로그인 + `/`: 허용
- 비로그인 + `/dashboard`: `/`로 리다이렉트
- 로그인 + `/`: `/dashboard`로 리다이렉트
- 로그인 + `/dashboard`: 허용

### 예외 규칙
- 로그인 + `/?landing=1`: 랜딩 페이지 허용

즉, 인증 사용자에게는 `/dashboard`가 기본 라우트이고, 랜딩 페이지는 명시적으로 요청했을 때만 보여준다.

## 왜 쿠키가 아니라 쿼리 파라미터를 썼는가
이전에는 "처음 한 번만 자동 이동"을 구현하기 위해 쿠키를 사용했다.  
하지만 지금 요구사항은 최초 1회 여부가 아니라, "기본은 대시보드로 보내되 랜딩을 의도적으로 보려는 요청만 예외 처리"다.

이 요구사항에서는 쿠키보다 명시적 파라미터가 더 적합하다.

- 쿠키 방식: 이전 방문 이력에 따라 동작
- 쿼리 방식: 현재 요청의 의도를 직접 표현

즉 아래처럼 해석한다.

- `/` 요청: 기본 경로 접근 -> `/dashboard`로 이동
- `/?landing=1` 요청: 랜딩 페이지를 의도적으로 보고 싶음 -> 허용

## 핵심 개념

### 1. 인증 여부 판별
`next-auth/jwt`의 `getToken()`으로 현재 요청이 로그인 상태인지 확인한다.

```ts
const token = await getToken({
  req: request,
  secret: process.env.NEXTAUTH_SECRET,
});
```

- `token`이 있으면 인증 사용자
- `token`이 없으면 비로그인 사용자

### 2. 랜딩 예외 플래그
로그인 사용자의 랜딩 페이지 접근을 허용할지 여부는 쿼리 파라미터로 결정한다.

```ts
const LANDING_BYPASS_PARAM = "landing";
const allowLandingView = searchParams.get(LANDING_BYPASS_PARAM) === "1";
```

즉 `?landing=1`이 붙어 있으면 "이 요청은 수동적으로 랜딩을 보려는 접근"으로 간주한다.

## 실제 코드

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const LANDING_BYPASS_PARAM = "landing";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname, searchParams } = request.nextUrl;
  const allowLandingView = searchParams.get(LANDING_BYPASS_PARAM) === "1";

  if (!token) {
    return pathname.startsWith("/dashboard")
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (pathname === "/" && !allowLandingView) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
```

## 구현 원리

### 비로그인 사용자 처리

```ts
if (!token) {
  return pathname.startsWith("/dashboard")
    ? NextResponse.redirect(new URL("/", request.url))
    : NextResponse.next();
}
```

- 비로그인 사용자가 `/dashboard` 접근: 차단
- 비로그인 사용자가 `/` 접근: 허용

### 인증 사용자 기본 라우팅

```ts
if (pathname === "/" && !allowLandingView) {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
```

이 조건은 아래 의미다.

- 로그인 상태다.
- 루트 `/`로 접근했다.
- 랜딩을 명시적으로 보려는 요청이 아니다.

그럼 `/dashboard`로 보낸다.

### 인증 사용자 랜딩 예외
로그인 상태라도 아래 요청은 허용한다.

```txt
/?landing=1
```

즉 메인 로고, 랜딩 버튼, 수동 주소 입력 등에서 랜딩 페이지로 보내고 싶다면 `/`가 아니라 `/?landing=1`로 보내면 된다.

## 요청 흐름 예시

### 경우 1. 비로그인 사용자가 `/` 접속
1. `getToken()` 결과가 `null`
2. 비로그인 분기
3. `/dashboard`가 아니므로 통과
4. 랜딩 페이지 렌더링

### 경우 2. 인증 사용자가 `/` 접속
1. `getToken()` 결과가 유효
2. `landing=1` 없음
3. `/dashboard`로 리다이렉트

### 경우 3. 인증 사용자가 `/?landing=1` 접속
1. `getToken()` 결과가 유효
2. `landing=1` 존재
3. 랜딩 페이지 허용

### 경우 4. 비로그인 사용자가 `/dashboard` 직접 접속
1. `getToken()` 결과가 `null`
2. 보호 경로로 판단
3. `/`로 리다이렉트

## 실무적으로 어떻게 쓰면 되는가
- 기본 진입 링크는 `/`로 둔다.
- 인증 사용자는 자동으로 `/dashboard`로 간다.
- 로그인 사용자가 랜딩을 보게 하는 링크나 로고는 `/?landing=1`로 연결한다.

즉 "기본 목적지"와 "의도적 예외 접근"을 URL 자체로 구분하는 구조다.

## 결론
현재 구조는 인증 사용자에게 `/dashboard`를 기본 라우트로 주되, 랜딩 페이지를 완전히 막지는 않는다.  
대신 랜딩 페이지는 `?landing=1`이라는 명시적 의도가 있을 때만 허용한다.

정리하면 아래와 같다.

- 기본 접근: 로그인 사용자는 `/dashboard`
- 예외 접근: 로그인 사용자는 `/?landing=1`일 때만 랜딩 허용
- 비로그인 사용자는 `/dashboard` 차단
