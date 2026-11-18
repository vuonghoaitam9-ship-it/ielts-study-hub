import { IeltsTest } from '../types';

export const DEMO_READING_TEST: IeltsTest = {
  id: 'demo-reading-vertical-farming',
  title: '[DỮ LIỆU MINH HỌA] Urban Vertical Farming & Sustainable Architecture',
  skill: 'reading',
  sourceType: 'demo',
  isDemo: true,
  sourceFileName: 'demo-illustrative-sample',
  createdAt: '2026-11-18T00:00:00.000Z',
  durationMinutes: 20,
  passages: [
    {
      id: 'demo-passage-1',
      passageNumber: 1,
      title: 'Vertical Agriculture in Dense Metropolitan Centres',
      subtitle:
        'Dữ liệu minh họa phục vụ kiểm thử giao diện IDP Split-Screen, Highlight & Ghi chú (không phải đề thi thật).',
      paragraphs: [
        {
          label: 'A',
          text: 'Over the past two decades, rapid urbanization has placed unprecedented pressure on arable land surrounding major metropolitan areas. Traditional open-field agriculture depends heavily on predictable rainfall patterns and expansive rural acreage, yet long-distance freight networks simultaneously generate substantial carbon emissions before fresh produce even reaches urban supermarkets.',
        },
        {
          label: 'B',
          text: 'In response, architectural researchers and agronomists have pioneered vertical farming—the cultivation of crops in vertically stacked layers inside climate-controlled buildings or repurposed industrial warehouses. Rather than relying on fertile soil, most commercial facilities employ hydroponic or aeroponic systems, circulating nutrient-rich water mist directly across suspended plant roots.',
        },
        {
          label: 'C',
          text: 'Empirical trials conducted in Singapore and the Netherlands demonstrate that closed-loop indoor farms consume up to ninety-five percent less freshwater than conventional irrigated fields. Because evaporation is captured by dehumidification units and recycled back into irrigation reservoirs, year-round harvests remain insulated from seasonal droughts or unexpected frost.',
        },
        {
          label: 'D',
          text: 'Nevertheless, critics highlight a stubborn economic bottleneck: artificial lighting. Substituting natural sunlight with high-efficiency light-emitting diode (LED) arrays demands continuous electricity, making leafy greens and culinary herbs commercially viable while rendering energy-intensive staple grains such as wheat or rice unprofitable indoors under current power tariffs.',
        },
        {
          label: 'E',
          text: 'To offset electricity consumption, next-generation urban architects are integrating transparent photovoltaic glass facades and capturing waste heat expelled by neighbouring municipal data centres. By coupling food production with existing city infrastructure, planners envision resilient neighbourhoods where nutritional security coexists with lower ecological footprints.',
        },
      ],
    },
  ],
  questions: [
    {
      id: 'demo-r-q1',
      questionNumber: 1,
      sectionNumber: 1,
      type: 'tfng',
      instruction:
        'Questions 1-3: Do the following statements agree with the information given in the passage? Choose TRUE, FALSE, or NOT GIVEN.',
      prompt:
        'Transporting agricultural goods over long distances contributes significantly to carbon emissions before reaching city stores.',
      options: ['TRUE', 'FALSE', 'NOT GIVEN'],
      acceptedAnswers: ['TRUE'],
      explanation:
        'Đoạn A nêu rõ mạng lưới vận chuyển đường dài (long-distance freight networks) tạo ra lượng khí thải carbon đáng kể (substantial carbon emissions) trước khi nông sản tới siêu thị đô thị.',
      evidenceQuote:
        'long-distance freight networks simultaneously generate substantial carbon emissions before fresh produce even reaches urban supermarkets',
    },
    {
      id: 'demo-r-q2',
      questionNumber: 2,
      sectionNumber: 1,
      type: 'tfng',
      prompt:
        'Most commercial vertical farms depend on importing nutrient-dense topsoil from rural districts.',
      options: ['TRUE', 'FALSE', 'NOT GIVEN'],
      acceptedAnswers: ['FALSE'],
      explanation:
        'Đoạn B khẳng định ngược lại: thay vì dùng đất màu mỡ ("Rather than relying on fertile soil"), phần lớn cơ sở thương mại dùng hệ thống thủy canh hoặc khí canh.',
      evidenceQuote:
        'Rather than relying on fertile soil, most commercial facilities employ hydroponic or aeroponic systems',
    },
    {
      id: 'demo-r-q3',
      questionNumber: 3,
      sectionNumber: 1,
      type: 'tfng',
      prompt:
        'Singapore currently produces more than half of its domestic vegetable supply using vertical farms.',
      options: ['TRUE', 'FALSE', 'NOT GIVEN'],
      acceptedAnswers: ['NOT GIVEN'],
      explanation:
        'Đoạn C chỉ đề cập các thử nghiệm thực chứng tại Singapore và Hà Lan chứng minh mức tiết kiệm nước tới 95%, hoàn toàn không nhắc tới tỷ lệ hơn một nửa nguồn cung rau nội địa.',
      evidenceQuote:
        'Empirical trials conducted in Singapore and the Netherlands demonstrate that closed-loop indoor farms consume up to ninety-five percent less freshwater',
    },
    {
      id: 'demo-r-q4',
      questionNumber: 4,
      sectionNumber: 1,
      type: 'gap_fill',
      instruction:
        'Questions 4-6: Complete the summary below. Choose ONE WORD ONLY from the passage for each answer.',
      prompt:
        'In closed-loop indoor farms, water lost through __________ is collected by dehumidification units and reused.',
      acceptedAnswers: ['evaporation'],
      explanation:
        'Đoạn C ghi rõ: "Because evaporation is captured by dehumidification units and recycled back into irrigation reservoirs...". Giới hạn ONE WORD ONLY nên đáp án là "evaporation".',
      evidenceQuote:
        'evaporation is captured by dehumidification units and recycled back into irrigation reservoirs',
    },
    {
      id: 'demo-r-q5',
      questionNumber: 5,
      sectionNumber: 1,
      type: 'gap_fill',
      prompt:
        'Because artificial LED lighting requires continuous __________, staple crops like wheat remain financially unviable indoors.',
      acceptedAnswers: ['electricity'],
      explanation:
        'Đoạn D giải thích hệ thống đèn LED đòi hỏi điện năng liên tục ("demands continuous electricity"), khiến các cây lương thực như lúa mì hay lúa gạo không có lãi.',
      evidenceQuote:
        'Substituting natural sunlight with high-efficiency light-emitting diode (LED) arrays demands continuous electricity',
    },
    {
      id: 'demo-r-q6',
      questionNumber: 6,
      sectionNumber: 1,
      type: 'gap_fill',
      prompt:
        'Modern urban buildings can reuse thermal energy released from nearby municipal __________ centres.',
      acceptedAnswers: ['data'],
      explanation:
        'Đoạn E đề cập kiến trúc sư thu hồi nhiệt thải từ các trung tâm dữ liệu đô thị lân cận ("neighbouring municipal data centres").',
      evidenceQuote:
        'capturing waste heat expelled by neighbouring municipal data centres',
    },
    {
      id: 'demo-r-q7',
      questionNumber: 7,
      sectionNumber: 1,
      type: 'mcq',
      instruction:
        'Questions 7-8: Choose the correct letter, A, B, C, or D.',
      prompt:
        'Which category of crops is currently described as commercially profitable in indoor vertical farms?',
      options: [
        'A. Wheat and irrigated rice',
        'B. Leafy greens and culinary herbs',
        'C. Drought-resistant root crops',
        'D. Imported tropical fruit',
      ],
      acceptedAnswers: ['B'],
      explanation:
        'Đoạn D nêu rõ đèn LED giúp rau ăn lá và thảo mộc ẩm thực ("leafy greens and culinary herbs") khả thi về mặt thương mại.',
      evidenceQuote:
        'making leafy greens and culinary herbs commercially viable',
    },
    {
      id: 'demo-r-q8',
      questionNumber: 8,
      sectionNumber: 1,
      type: 'mcq',
      prompt:
        'Why are architects incorporating photovoltaic glass facades into newer vertical farming projects?',
      options: [
        'A. To block excessive ultraviolet sunlight',
        'B. To eliminate the need for dehumidification units',
        'C. To help counterbalance high electrical power demands',
        'D. To increase evaporation rates inside warehouses',
      ],
      acceptedAnswers: ['C'],
      explanation:
        'Đoạn E mở đầu bằng mục đích bù đắp mức tiêu thụ điện năng ("To offset electricity consumption").',
      evidenceQuote:
        'To offset electricity consumption, next-generation urban architects are integrating transparent photovoltaic glass facades',
    },
    {
      id: 'demo-r-q9',
      questionNumber: 9,
      sectionNumber: 1,
      type: 'matching_info',
      instruction:
        'Questions 9-10: Which paragraph (A-E) contains the following information?',
      prompt:
        'A comparison showing dramatic reductions in freshwater consumption compared with outdoor farming.',
      options: ['A', 'B', 'C', 'D', 'E'],
      acceptedAnswers: ['C'],
      explanation:
        'Đoạn C đưa số liệu tiết kiệm tới 95% nước ngọt so với canh tác tưới tiêu truyền thống.',
      evidenceQuote:
        'consume up to ninety-five percent less freshwater than conventional irrigated fields',
    },
    {
      id: 'demo-r-q10',
      questionNumber: 10,
      sectionNumber: 1,
      type: 'matching_info',
      prompt:
        'Examples of buildings that are converted for multi-layered indoor cultivation.',
      options: ['A', 'B', 'C', 'D', 'E'],
      acceptedAnswers: ['B'],
      explanation:
        'Đoạn B nhắc đến việc trồng trọt bên trong các tòa nhà kiểm soát khí hậu hoặc nhà kho công nghiệp được tái sử dụng ("repurposed industrial warehouses").',
      evidenceQuote:
        'inside climate-controlled buildings or repurposed industrial warehouses',
    },
  ],
};
