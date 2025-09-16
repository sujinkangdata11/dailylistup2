export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API 경로 라우팅
    if (url.pathname === '/') {
      return new Response('YouTube Channel Data API - listup.anime-toon-7923.workers.dev', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (url.pathname === '/api/channels') {
      try {
        // KV에서 채널 데이터 가져오기
        const channelData = await env.CHANNEL_DATA.get('channel-data', { type: 'json' });

        if (!channelData) {
          return new Response(JSON.stringify({ error: 'No channel data found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // channelData가 배열인지 확인
        if (!Array.isArray(channelData)) {
          return new Response(JSON.stringify({ error: 'Channel data is not in array format' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 쿼리 파라미터 처리
        const limit = parseInt(url.searchParams.get('limit')) || channelData.length;
        const offset = parseInt(url.searchParams.get('offset')) || 0;

        const result = {
          total: channelData.length,
          limit,
          offset,
          data: channelData.slice(offset, offset + limit)
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 404 응답
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders
    });
  }
};