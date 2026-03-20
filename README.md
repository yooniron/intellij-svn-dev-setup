# IntelliJ SVN DEV INSTALLER

![Node](https://img.shields.io/badge/node-v18+-green)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> **IntelliJ 개발환경 자동화 CLI 도구** > SVN 체크아웃부터 IntelliJ 실행 설정(RunConfig)까지, 신규 팀원의 온보딩 시간을 90% 단축합니다.
신규 팀원이 프로젝트를 로컬에 세팅할 때 필요한 반복 작업(SVN 체크아웃, 설정 파일 수정, 환경 변수 치환, IntelliJ Run Configuration 수정)을 단일 CLI 명령으로 처리합니다.

## 주요 특징

- **⚡ 원클릭 온보딩**: 프로젝트명, 경로, Tomcat 위치, 포트 입력만으로 세팅 종료.
- **📊 실시간 모니터링**: `MultiBar`를 활용하여 SVN 체크아웃 진행률과 로그를 동시에 시각화.
- **📂 표준 템플릿 배포**: `template/` 내의 설정 파일을 프로젝트 구조에 맞춰 자동 복사 및 동기화.
- **⚙️ 지능형 변수 주입**: `.xml`, `.properties`, `.js` 등 주요 파일 내 `${변수}` 플레이스홀더를 일괄 치환.
- **🧠 IntelliJ UI 동기화**: RunConfig XML을 직접 수정하여 IntelliJ UI상에서도 설정된 포트가 즉시 반영되도록 처리.
---

## 동작 흐름

### STEP 1 — SVN Checkout

`svn list -R`을 먼저 실행해 전체 파일 목록을 스캔하고 총 항목 수를 확보합니다. 이후 `svn checkout`을 실행하면서 MultiBar로 진행률과 체크아웃 로그를 동시에 표시합니다.

```
A    src/main/java/SomeFile.java        ← 로그가 위로 스크롤
A    src/main/webapp/WEB-INF/web.xml
SVN |████████████░░░░░░░░| 62% · 1547/2490   ← 바는 하단 고정
```

### STEP 2 — Template Copy

`template/` 디렉터리를 재귀 탐색해 모든 파일을 상대 경로를 유지하면서 체크아웃된 프로젝트로 복사합니다.

### STEP 3 — Variable Inject

`.xml`, `.properties`, `.json`, `.jsp`, `.js` 파일에서 아래 플레이스홀더를 사용자 입력값으로 일괄 치환합니다.

| 변수 | 설명 |
|------|------|
| `${PROJECT_NAME}` | 프로젝트명 |
| `${TOMCAT_HOME}` | Tomcat 설치 경로 |
| `${SERVER_PORT}` | 서비스 포트 |

### STEP 4 — IntelliJ RunConfig Fix

`.idea/runConfigurations/` 디렉터리의 XML 파일을 수정합니다.

- `APPLICATION_SERVER_NAME="Tomcat 8.5.91"` 속성 삽입
- `<port>` 값을 입력한 포트로 교체
- `BASE_DIRECTORY` 요소 제거 (경로 충돌 방지)

---

## 사전 준비 사항

- [ ] **SVN CLI** — `svn --version`으로 확인
- [ ] **Node.js** — v18+ 이상 권장(pkg 빌드 기준)
- [ ] **Tomcat 8.5 이상** — 설치 경로 파악 (예: `C:/tomcat/apache-tomcat-8.5.91`)
- [ ] **IntelliJ IDEA Ultimate** — 권장 (Community는 Tomcat 런타임 미지원)
- [ ] **SVN 서버 접근 가능한 네트워크**

---

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 실행

**Windows (권장)**

```bat
setup.bat
```

**직접 실행**

```bash
node intellij-svn-dev-setup.js
```

### 3. 대화형 프롬프트

| 항목 | 설명 | 기본값                         |
|------|------|-----------------------------|
| 프로젝트명 (SVN) | SVN 저장소의 프로젝트 디렉터리명 | `config.defaultProjectName` |
| 설치할 프로젝트 경로 | 로컬 체크아웃 상위 디렉터리 | `config.defaultProjectDir`  |
| Tomcat 경로 | Tomcat 설치 루트 경로 | `config.defaultTomcatHome`  |
| 서비스 포트 | Tomcat 서비스 포트 | `config.defaultPort`        |

설치 완료 후 IntelliJ에서 프로젝트를 열면 별도 설정 없이 바로 실행 가능합니다.

---

## config/config.json

```json
{
  "svnRootUrl": "svn://127.0.0.1/",
  "defaultProjectName": "MY_PROJECT",
  "defaultProjectDir": "C:/PROJECT_ROOT",
  "defaultTomcatHome": "C:/tomcat/apache-tomcat-8.5.91",
  "defaultPort": 8080
}
```

| 필드 | 설명                                                               |
|------|------------------------------------------------------------------|
| `svnRootUrl` | SVN 저장소 루트 URL. 끝에 `/` 필수. 프롬프트에서 입력한 프로젝트명이 뒤에 붙어 체크아웃 URL이 결정됨 |
| `defaultProjectName` | SVN 저장소 이름. 프롬프트에서 입력한 프로젝트경로에 해당 프로젝트 이름으로 설정됨                  |
| `defaultProjectDir` | 프로젝트 저장소 루트. 설치할 위치를 지정함                                         |
| `defaultTomcatHome` | 로컬 톰캣 경로. 실행할 로컬 톰캣파일을 위치                                        |
| `defaultPort` | 로컬 HTTP 포트. Run Configuration에 설정할 HTTP PORT                     |

> `config/config.json` 파일이 없으면 스크립트가 즉시 종료됩니다.

---

## 프로젝트 구조

```
intellij-svn-dev-setup/
├── intellij-svn-dev-setup.js        — 메인 설치 스크립트
├── intellij-svn-dev-setup.exe       — 배포용 단독 실행 바이너리
├── setup.bat                        — Windows 실행 래퍼
├── config/
│   └── config.json       — SVN 저장소 설정
├── template/             — 프로젝트 초기화 템플릿 파일
├── scripts/              — 보조 스크립트
├── bin/                  — 보조 바이너리
├── package.json
└── package-lock.json
```

## 기술 스택

| 패키지 | 버전 | 용도 |
|--------|------|------|
| [chalk](https://github.com/chalk/chalk) | ^4.1.2 | 터미널 출력 컬러링 |
| [cli-progress](https://github.com/npkgjs/cli-progress) | ^3.12.0 | 프로그레스바 (SingleBar / MultiBar) |
| [inquirer](https://github.com/SBoudrias/Inquirer.js) | ^8.2.7 | 대화형 CLI 프롬프트 |
| [ora](https://github.com/sindresorhus/ora) | ^5.4.1 | 비동기 작업 스피너 |

## 빌드 (배포용 exe)

`intellij-svn-dev-setup.exe`는 Node.js 없이도 실행 가능한 단독 바이너리입니다.

```bash
npx pkg intellij-svn-dev-setup.js --targets node18-win-x64 --output intellij-svn-dev-setup.exe
```
