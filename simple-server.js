// 간단한 OAuth 서버 - listup.anime-toon-7923.workers.dev 전용
require('dotenv').config();
const http = require('http');
const url = require('url');

const PORT = 8081;

// Google OAuth 설정
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = 'http://localhost:8081/auth/callback';
const SCOPES = 'https://www.googleapis.com/auth/drive';

let syncStatus = '⏳ 대기 중...';

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`📥 요청: ${req.method} ${pathname}`);
  console.log(`🔗 전체 URL: ${req.url}`);
  console.log(`📋 쿼리 파라미터:`, parsedUrl.query);

  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/') {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(SCOPES)}&` +
      `access_type=offline`;

    console.log(`🔐 OAuth URL 생성됨:`);
    console.log(`   Client ID: ${CLIENT_ID}`);
    console.log(`   Redirect URI: ${REDIRECT_URI}`);
    console.log(`   Scopes: ${SCOPES}`);
    console.log(`   전체 Auth URL: ${authUrl}`);

    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Listup Sync - YouTube Channel Data</title>
        </head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>🚀 YouTube 채널 데이터 동기화</h1>
          <p>Google Drive 데이터를 <strong>listup.anime-toon-7923.workers.dev</strong>에 동기화합니다</p>

          <div style="margin: 40px 0;">
            <label>Google Drive 폴더 ID:</label><br>
            <input type="text" id="folderId" placeholder="앞전 \uc124정된 \uac12" value="" style="width: 400px; padding: 10px; margin: 10px;">
            <br><br>
            <label>Client Secret:</label><br>
            <input type="password" id="clientSecret" placeholder="앞전 \uc124정된 \uac12" value="" style="width: 400px; padding: 10px; margin: 10px;">
            <br><br>
            <button onclick="startAuth()" style="padding: 15px 30px; font-size: 16px; background: #4285f4; color: white; border: none; border-radius: 5px;">
              🔐 Google 로그인 후 listup 동기화 시작
            </button>
          </div>

          <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3>🔧 개발자 도구</h3>
            <a href="/debug" style="color: #1a73e8; text-decoration: none; margin-right: 20px;">🔍 OAuth 디버그 정보</a>
            <a href="/status" style="color: #1a73e8; text-decoration: none; margin-right: 20px;">📊 동기화 상태</a>
            <small style="color: #666; display: block; margin-top: 10px;">
              ⚠️ access_denied 에러가 발생하면 브라우저 개발자 도구(F12) 콘솔과 서버 로그를 확인하세요
            </small>
          </div>

          <script>
            function startAuth() {
              console.log('🚀 OAuth 인증 시작!');

              const folderIdInput = document.getElementById('folderId');
              const clientSecretInput = document.getElementById('clientSecret');

              console.log('📋 입력값 확인:');
              console.log('   폴더 ID:', folderIdInput.value);
              console.log('   Client Secret:', clientSecretInput.value ? '입력됨' : '없음');

              if (!folderIdInput.value) {
                console.error('❌ Google Drive 폴더 ID가 비어있음');
                alert('Google Drive 폴더 ID를 입력해주세요');
                return;
              }

              if (!clientSecretInput.value) {
                console.error('❌ Client Secret이 비어있음');
                alert('Client Secret을 입력해주세요');
                return;
              }

              const data = JSON.stringify({
                folderId: folderIdInput.value,
                clientSecret: clientSecretInput.value
              });

              const authUrl = '${authUrl}&state=' + encodeURIComponent(btoa(data));

              console.log('🔗 생성된 Auth URL:');
              console.log(authUrl);
              console.log('🌐 Google OAuth 페이지로 이동 중...');

              window.location.href = authUrl;
            }
          </script>
        </body>
      </html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else if (pathname === '/auth/callback') {
    const { code, state, error, error_description, error_uri } = parsedUrl.query;

    console.log('🔄 콜백 처리 시작');
    console.log('📋 전체 쿼리 파라미터:', JSON.stringify(parsedUrl.query, null, 2));
    console.log('   Code:', code ? code.substring(0, 20) + '...' : 'NONE');
    console.log('   State:', state ? state.substring(0, 50) + '...' : 'NONE');
    console.log('   Error:', error || 'NONE');
    console.log('   Error Description:', error_description || 'NONE');
    console.log('   Error URI:', error_uri || 'NONE');

    if (error) {
      console.error('❌ OAuth 에러:', error);
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`OAuth Error: ${error}`);
      return;
    }

    if (!code) {
      console.error('❌ Authorization code가 없습니다');
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Authorization code not found');
      return;
    }

    try {
      console.log('🔍 State 디코딩 중...');
      // state에서 폴더 ID와 Client Secret 파싱
      const decodedData = JSON.parse(atob(state));
      const folderId = decodedData.folderId;
      const clientSecret = decodedData.clientSecret;

      console.log('✅ 인증 성공!');
      console.log('폴더 ID:', folderId);
      console.log('인증 코드:', code.substring(0, 20) + '...');
      console.log('Client Secret:', clientSecret ? clientSecret.substring(0, 10) + '...' : 'NONE');

      syncStatus = '⏳ 토큰 교환 중...';

      // 토큰 교환 시작
      startSyncProcess(code, folderId, clientSecret);

      const html = `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>동기화 진행중...</title>
            <style>
              body { font-family: Arial; padding: 40px; text-align: center; background: #f5f5f5; }
              .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #4285f4;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
                display: inline-block;
              }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              #status {
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin: 20px auto;
                max-width: 600px;
                min-height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
              }
              .completed { background: #e8f5e8 !important; }
            </style>
          </head>
          <body>
            <h1>🔄 Google Drive → KV 동기화 진행중...</h1>
            <p>폴더 ID: <strong>${folderId}</strong></p>
            <div id="status">
              <div class="spinner" id="spinner"></div>
              <div id="statusText">⏳ 토큰 교환 중...</div>
            </div>
            <script>
              setInterval(() => {
                fetch('/status').then(r => r.text()).then(status => {
                  const statusDiv = document.getElementById('status');
                  const spinner = document.getElementById('spinner');
                  const statusText = document.getElementById('statusText');

                  statusText.innerHTML = status;

                  if (status.includes('🎉') || status.includes('❌')) {
                    spinner.style.display = 'none';
                    statusDiv.className = 'completed';
                    document.title = '동기화 완료!';
                  } else {
                    spinner.style.display = 'inline-block';
                  }
                });
              }, 1000);
            </script>
          </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);

    } catch (error) {
      console.error('💥 State 디코딩 실패:', error.message);
      console.error('   Raw State:', state);
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <head><meta charset="UTF-8"><title>에러</title></head>
          <body style="font-family: Arial; padding: 40px;">
            <h1>❌ State 파라미터 에러</h1>
            <p>State 디코딩에 실패했습니다: ${error.message}</p>
            <p>Raw State: ${state}</p>
          </body>
        </html>
      `);
    }
  } else if (pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(syncStatus);
  } else if (pathname === '/debug') {
    console.log('🔍 OAuth 디버그 정보 요청됨');
    const debugInfo = {
      timestamp: new Date().toISOString(),
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: SCOPES,
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline`,
      serverStatus: 'running'
    };

    const debugHtml = `
      <html>
        <head><meta charset="UTF-8"><title>OAuth Debug Info</title></head>
        <body style="font-family: monospace; padding: 20px; background: #1a1a1a; color: #00ff00;">
          <h1>🔍 OAuth 디버그 정보</h1>
          <pre style="background: #2a2a2a; padding: 15px; border-radius: 5px; overflow-x: auto;">
${JSON.stringify(debugInfo, null, 2)}
          </pre>
          <h2>📋 체크리스트</h2>
          <ul>
            <li>✅ Client ID: ${CLIENT_ID.substring(0, 20)}...</li>
            <li>✅ Redirect URI: ${REDIRECT_URI}</li>
            <li>✅ Scopes: ${SCOPES}</li>
            <li>⚠️ Google Console: OAuth 동의 화면 설정 확인 필요</li>
            <li>⚠️ Test Users: help.vidhunt2@gmail.com 등록 상태 확인</li>
            <li>⚠️ App Status: 테스트 모드 vs 게시됨</li>
          </ul>
          <p><a href="/">← 메인으로 돌아가기</a></p>
        </body>
      </html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(debugHtml);
  } else if (pathname === '/error') {
    console.log('🔥 에러 페이지 접근됨');
    console.log('   쿼리 파라미터:', parsedUrl.query);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
        <head><meta charset="UTF-8"><title>OAuth 에러</title></head>
        <body style="font-family: Arial; padding: 40px;">
          <h1>🔥 OAuth 에러 발생</h1>
          <pre>${JSON.stringify(parsedUrl.query, null, 2)}</pre>
        </body>
      </html>
    `);
  } else {
    console.log('🔍 알 수 없는 경로 접근:', pathname);
    console.log('   쿼리:', parsedUrl.query);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Listup OAuth 서버 실행: http://localhost:${PORT}`);
  console.log(`📍 서버 주소: http://127.0.0.1:${PORT}`);
  console.log(`🌐 서버가 포트 ${PORT}에서 대기 중...`);
  console.log('📋 브라우저에서 위 주소를 열어서 listup.anime-toon-7923.workers.dev 동기화를 시작하세요');
});

server.on('error', (err) => {
  console.error('❌ 서버 에러:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`💥 포트 ${PORT}가 이미 사용 중입니다. 다른 포트를 사용하거나 기존 프로세스를 종료하세요.`);
  }
});

// 동기화 프로세스 시작
async function startSyncProcess(code, folderId, clientSecret) {
  try {
    syncStatus = '🔄 토큰 교환 중...';

    // 1. 토큰 교환
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('🔍 토큰 응답:', tokenData);

    if (!tokenData.access_token) {
      throw new Error('토큰 교환 실패: ' + JSON.stringify(tokenData));
    }

    syncStatus = '📂 Google Drive 폴더 조회 중...';

    // 2. 폴더 내 파일 목록 조회 (페이지네이션으로 모든 파일 가져오기)
    let allFiles = [];
    let nextPageToken = null;

    do {
      const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType),nextPageToken&pageSize=1000${nextPageToken ? '&pageToken=' + nextPageToken : ''}`;

      const filesResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const filesData = await filesResponse.json();

      if (filesData.files) {
        allFiles = allFiles.concat(filesData.files);
      }

      nextPageToken = filesData.nextPageToken;

      console.log(`📁 현재까지 ${allFiles.length}개 파일 발견, 다음 페이지: ${nextPageToken ? '있음' : '없음'}`);

    } while (nextPageToken);

    console.log(`📁 전체 ${allFiles.length}개 파일 발견`);
    const jsonFiles = allFiles.filter(file => file.name.endsWith('.json'));
    console.log(`📄 JSON 파일 ${jsonFiles.length}개 발견`);

    // 인덱스 파일 제외하고 실제 채널 데이터만 필터링 (UCxxxxxx.json 형태)
    const channelFiles = jsonFiles.filter(file =>
      file.name.startsWith('UC') && file.name.endsWith('.json')
    );
    console.log(`📊 채널 데이터 파일 ${channelFiles.length}개 발견 (인덱스 파일 제외)`);

    // 🔧 개발용 제한: 2개 파일만 처리
    const devLimit = 100000;
    const filesToProcess = channelFiles.slice(0, devLimit);
    console.log(`🔧 개발 모드: ${filesToProcess.length}개 파일만 처리 (전체 ${channelFiles.length}개 중)`);

    syncStatus = `📄 ${filesToProcess.length}개 JSON 파일 처리 (개발 모드)! 단일 channel-data 키로 통합 업로드 시작...`;

    // 3. 모든 JSON 파일을 다운로드해서 단일 배열로 통합
    const { spawn } = require('child_process');
    const fs = require('fs');
    const allChannelData = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];

      syncStatus = `📥 ${i+1}/${filesToProcess.length} 다운로드 중: ${file.name}`;

      try {
        // 파일 다운로드
        const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        });

        const fileContent = await fileResponse.text();

        // JSON 유효성 검사 및 배열에 추가
        const jsonData = JSON.parse(fileContent);
        allChannelData.push(jsonData);
        successCount++;

        console.log(`✅ ${file.name} 다운로드 완료 (${successCount}/${filesToProcess.length})`);

      } catch (error) {
        failCount++;
        console.error(`❌ ${file.name} 다운로드 실패:`, error.message);
      }
    }

    // 4. 통합된 데이터를 단일 channel-data 키로 업로드
    if (allChannelData.length > 0) {
      syncStatus = `📤 ${allChannelData.length}개 채널 데이터를 단일 channel-data 키로 KV 업로드 중...`;

      try {
        // 임시 파일에 통합 데이터 저장
        const consolidatedData = JSON.stringify(allChannelData, null, 2);
        fs.writeFileSync('consolidated-channel-data.json', consolidatedData);

        // wrangler로 단일 키 업로드
        const kvProcess = spawn('wrangler', [
          'kv', 'key', 'put', 'channel-data',
          '--namespace-id', process.env.KV_NAMESPACE_ID,
          '--path', 'consolidated-channel-data.json',
          '--remote'
        ], { stdio: 'pipe' });

        await new Promise((resolve, reject) => {
          kvProcess.on('close', (code) => {
            // 임시 파일 삭제
            try {
              fs.unlinkSync('consolidated-channel-data.json');
            } catch (e) {}

            if (code === 0) {
              console.log(`✅ 통합 channel-data 키 업로드 성공!`);
              resolve();
            } else {
              console.error(`❌ 통합 channel-data 키 업로드 실패`);
              reject(new Error(`KV upload failed for consolidated data`));
            }
          });
        });

        syncStatus = `🎉 동기화 완료!<br>📊 총 ${allChannelData.length}개 채널이 단일 channel-data 키로 <a href="https://listup.anime-toon-7923.workers.dev/api/channels" target="_blank">KV Storage</a>에 업로드되었습니다!<br>🔧 개발 모드: ${devLimit}개 파일 처리됨`;
        console.log(`✅ 전체 동기화 성공! ${allChannelData.length}개 채널을 단일 키로 업로드 완료`);

      } catch (error) {
        syncStatus = `❌ KV 업로드 실패: ${error.message}`;
        console.error('❌ KV 업로드 에러:', error);
      }
    } else {
      syncStatus = `❌ 처리된 채널 데이터가 없습니다. 다운로드 실패: ${failCount}개`;
      console.log(`❌ 처리된 데이터 없음`);
    }

  } catch (error) {
    syncStatus = `❌ 동기화 실패: ${error.message}`;
    console.error('❌ 동기화 에러:', error);
  }
}

console.log('🔄 서버 시작 중...');