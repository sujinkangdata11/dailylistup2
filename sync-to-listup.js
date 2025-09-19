// Google Drive에서 JSON 파일을 읽고 listup.anime-toon-7923.workers.dev KV로 동기화
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

class ListupSyncService {
  constructor(folderId, accessToken) {
    this.folderId = folderId;
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({ access_token: accessToken });
    this.drive = google.drive({
      version: 'v3',
      auth: this.auth
    });
  }

  async getFilesFromDrive() {
    console.log('📂 Google Drive에서 파일 목록 조회 중...');

    try {
      let allFiles = [];
      let nextPageToken = null;
      let pageCount = 0;

      do {
        pageCount++;
        console.log(`📄 페이지 ${pageCount} 조회 중...`);

        const response = await this.drive.files.list({
          q: `'${this.folderId}' in parents and mimeType='application/json'`,
          fields: 'nextPageToken, files(id, name, modifiedTime)',
          orderBy: 'modifiedTime desc',
          pageSize: 1000, // 최대 1000개씩
          pageToken: nextPageToken
        });

        allFiles = allFiles.concat(response.data.files);
        nextPageToken = response.data.nextPageToken;

        console.log(`📄 페이지 ${pageCount}: ${response.data.files.length}개 파일 (누적: ${allFiles.length}개)`);

      } while (nextPageToken);

      console.log(`📄 총 ${allFiles.length}개 JSON 파일 발견 (${pageCount}페이지)`);
      return allFiles;
    } catch (error) {
      console.error('❌ Drive 파일 목록 조회 실패:', error.message);
      throw error;
    }
  }

  async downloadFile(fileId, fileName) {
    console.log(`⬇️  ${fileName} 다운로드 중...`);

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      // response.data가 이미 객체인 경우와 문자열인 경우를 모두 처리
      if (typeof response.data === 'string') {
        return JSON.parse(response.data);
      } else {
        return response.data;
      }
    } catch (error) {
      console.error(`❌ ${fileName} 다운로드 실패:`, error.message);
      throw error;
    }
  }

  async processChannelData() {
    console.log('🚀 채널 데이터 처리 시작...');

    const files = await this.getFilesFromDrive();
    const allChannelData = [];
    let processedCount = 0;

    console.log(`📊 총 ${files.length}개 파일 발견, 처리 시작...`);

    for (const file of files) {
      // _channel_index.json 파일은 제외
      if (file.name === '_channel_index.json') {
        console.log(`⏭️  ${file.name} 제외 처리`);
        continue;
      }

      try {
        const data = await this.downloadFile(file.id, file.name);

        // 파일명에서 채널 정보 추출
        const channelInfo = this.extractChannelInfo(file.name, data);

        if (channelInfo) {
          allChannelData.push(channelInfo);
          processedCount++;
          console.log(`✅ ${processedCount}/${files.length - 1} 처리 완료: ${file.name}`);
        }
      } catch (error) {
        console.error(`⚠️  ${file.name} 처리 중 오류:`, error.message);
      }
    }

    console.log(`📊 총 ${allChannelData.length}개 채널 데이터 처리 완료`);
    return allChannelData;
  }

  extractChannelInfo(fileName, data) {
    // ⚠️ 중요: 이 부분 절대 건드리지 말 것! ⚠️
    // 원본 JSON 데이터를 완전히 그대로 저장해야 함
    // - 파싱 없음
    // - 필드 추가 없음 (fileName, lastUpdated 등 금지)
    // - 순서 변경 없음
    // - 구조 변경 없음
    //
    // 최종 KV 저장 형태:
    // {
    //   "channelId": "UCo4lhdBH3sFwkTjIHyfNmYw",
    //   "staticData": { "publishedAt": "2015-02-07T04:13:25Z" },
    //   "snapshots": [...],
    //   "recentThumbnailsHistory": [...],
    //   "dailyViewsHistory": [...],
    //   "weeklyViewsHistory": [...],
    //   "subscriberHistory": [...],
    //   "metadata": {...}
    // }
    return data;
  }

  async saveToKVFormat() {
    const channelData = await this.processChannelData();

    // KV에 저장할 형태로 포맷
    const kvData = {
      lastUpdated: new Date().toISOString(),
      totalChannels: channelData.length,
      channels: channelData
    };

    // 로컬에 JSON 파일로 저장
    const outputPath = path.join(__dirname, 'kv-data.json');
    await fs.writeFile(outputPath, JSON.stringify(kvData, null, 2));

    console.log(`💾 KV 데이터 파일 생성: ${outputPath}`);
    console.log(`📊 총 ${channelData.length}개 채널 데이터 처리 완료`);

    return outputPath;
  }
}

// 메인 실행 함수
async function main() {
  const folderId = process.argv[2];
  const accessToken = process.argv[3];

  if (!folderId || !accessToken) {
    console.error('❌ 사용법: node sync-to-listup.js <FOLDER_ID> <ACCESS_TOKEN>');
    process.exit(1);
  }

  try {
    const syncService = new ListupSyncService(folderId, accessToken);
    await syncService.saveToKVFormat();
    console.log('🎉 listup 동기화 준비 완료!');
  } catch (error) {
    console.error('❌ 동기화 실패:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ListupSyncService;