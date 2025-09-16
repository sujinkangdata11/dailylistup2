// Google Drive에서 JSON 파일을 읽고 listup.anime-toon-7923.workers.dev KV로 동기화
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

class ListupSyncService {
  constructor(folderId, accessToken) {
    this.folderId = folderId;
    this.drive = google.drive({
      version: 'v3',
      auth: new google.auth.OAuth2()
    });
    this.drive.auth.setCredentials({ access_token: accessToken });
  }

  async getFilesFromDrive() {
    console.log('📂 Google Drive에서 파일 목록 조회 중...');

    try {
      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and mimeType='application/json'`,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      console.log(`📄 총 ${response.data.files.length}개 JSON 파일 발견`);
      return response.data.files;
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

      return JSON.parse(response.data);
    } catch (error) {
      console.error(`❌ ${fileName} 다운로드 실패:`, error.message);
      throw error;
    }
  }

  async processChannelData() {
    console.log('🚀 채널 데이터 처리 시작...');

    const files = await this.getFilesFromDrive();
    const allChannelData = [];

    for (const file of files) {
      try {
        const data = await this.downloadFile(file.id, file.name);

        // 파일명에서 채널 정보 추출
        const channelInfo = this.extractChannelInfo(file.name, data);

        if (channelInfo) {
          allChannelData.push(channelInfo);
          console.log(`✅ ${file.name} 처리 완료`);
        }
      } catch (error) {
        console.error(`⚠️  ${file.name} 처리 중 오류:`, error.message);
      }
    }

    console.log(`📊 총 ${allChannelData.length}개 채널 데이터 준비 완료`);
    return allChannelData;
  }

  extractChannelInfo(fileName, data) {
    // JSON 파일에서 채널 정보 추출
    if (data && data.items && data.items.length > 0) {
      const channel = data.items[0];

      return {
        channelId: channel.id,
        title: channel.snippet?.title || 'Unknown',
        description: channel.snippet?.description || '',
        subscriberCount: parseInt(channel.statistics?.subscriberCount) || 0,
        videoCount: parseInt(channel.statistics?.videoCount) || 0,
        viewCount: parseInt(channel.statistics?.viewCount) || 0,
        publishedAt: channel.snippet?.publishedAt,
        thumbnails: channel.snippet?.thumbnails,
        customUrl: channel.snippet?.customUrl,
        fileName: fileName,
        lastUpdated: new Date().toISOString()
      };
    }

    return null;
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