# stick

아이디어를 빠르게 기록하고 다시 찾아볼 수 있는 정적 웹 프로토타입입니다.

## 실행

별도 빌드 없이 `index.html`을 열거나 정적 서버로 실행할 수 있습니다.

```powershell
npx serve .
```

## Vercel 배포

Vercel에서 이 폴더를 새 프로젝트로 Import하면 별도 설정 없이 배포됩니다.

- Framework Preset: `Other`
- Build Command: 비워두기
- Output Directory: `.`

아이디어 데이터는 현재 브라우저의 `localStorage`에 저장됩니다. 실제 서비스 단계에서는 로그인과 데이터베이스 연동이 필요합니다.
