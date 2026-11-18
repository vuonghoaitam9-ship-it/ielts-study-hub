export interface BandCriterion {
  code: string;
  name: string;
  weight: string;
  focusVi: string;
  band6Characteristics: string[];
  band7PlusTargets: string[];
}

export interface Task1GuideItem {
  id: 'line' | 'bar' | 'pie' | 'table' | 'map' | 'process';
  title: string;
  titleVi: string;
  promptAnalysis: string[];
  structure: Array<{ paragraph: string; role: string; tips: string }>;
  scoringStructures: string[];
  keyVocabulary: Array<{ term: string; meaningVi: string }>;
  miniModelSnippet: string;
}

export interface Task2GuideItem {
  id:
    | 'opinion'
    | 'discussion'
    | 'adv_disadv'
    | 'problem_solution'
    | 'two_part';
  title: string;
  titleVi: string;
  recognitionCue: string;
  promptAnalysis: string[];
  structure: Array<{ paragraph: string; role: string; tips: string }>;
  scoringStructures: string[];
  commonTraps: string[];
  miniModelSnippet: string;
}

export type IdeaBankTopic =
  | 'Education'
  | 'Technology'
  | 'Environment'
  | 'Health'
  | 'Work'
  | 'Society'
  | 'Government'
  | 'Culture';

export type EssayCategoryFilter =
  | 'Opinion'
  | 'Discussion'
  | 'Advantage/Disadvantage'
  | 'Problem/Solution'
  | 'Two-part Question';

export interface IdeaBankEntry {
  id: string;
  topic: IdeaBankTopic;
  essayType: EssayCategoryFilter;
  prompt: string;
  promptSummaryVi: string;
  sideATitle: string;
  sideAArguments: string[];
  sideBTitle: string;
  sideBArguments: string[];
  examples: string[];
  collocations: Array<{ phrase: string; meaningVi: string }>;
}

export const WRITING_CRITERIA: BandCriterion[] = [
  {
    code: 'TA / TR',
    name: 'Task Achievement (Task 1) / Task Response (Task 2)',
    weight: '25%',
    focusVi:
      'Trả lời đúng và đủ mọi yêu cầu đề bài, có lập trường rõ ràng (Task 2) hoặc Overview súc tích + số liệu chính xác (Task 1).',
    band6Characteristics: [
      'Task 1 thiếu đoạn Overview rõ ràng hoặc liệt kê số liệu rời rạc từng năm không nhóm.',
      'Task 2 trả lời một phần câu hỏi hoặc luận điểm chưa được phát triển sâu (chỉ nêu ý, thiếu giải thích nguyên nhân/hệ quả).',
    ],
    band7PlusTargets: [
      'Task 1 luôn có Overview nổi bật xu hướng chính và điểm cao nhất/thấp nhất mà KHÔNG chứa số liệu chi tiết.',
      'Task 2 phát triển luận điểm theo mạch PEEL (Point - Explanation - Example - Link) và giữ lập trường nhất quán từ Intro đến Conclusion.',
    ],
  },
  {
    code: 'CC',
    name: 'Coherence & Cohesion',
    weight: '25%',
    focusVi:
      'Tính mạch lạc của bố cục đoạn văn, cách dẫn dắt logic giữa các câu và sử dụng từ nối tự nhiên không lạm dụng.',
    band6Characteristics: [
      'Lạm dụng từ nối máy móc đầu mỗi câu (Firstly, Secondly, Moreover, In addition).',
      'Chia đoạn chưa hợp lý hoặc thiếu câu chủ đề (topic sentence) rõ ràng.',
    ],
    band7PlusTargets: [
      'Mỗi đoạn Body tập trung một ý trung tâm với Topic Sentence ngắn gọn, sắc nét.',
      'Dùng phép quy chiếu (this trend, such measures, the former/the latter) và liên kết ngầm thay cho từ nối rập khuôn.',
    ],
  },
  {
    code: 'LR',
    name: 'Lexical Resource',
    weight: '25%',
    focusVi:
      'Độ chính xác và đa dạng của từ vựng học thuật, khả năng dùng collocations tự nhiên theo chủ đề và paraphrase hiệu quả.',
    band6Characteristics: [
      'Lặp từ khóa của đề bài nhiều lần hoặc cố ép từ "đao to búa lớn" sai ngữ cảnh.',
      'Sai chính tả hoặc nhầm dạng từ (word form) và giới từ đi kèm.',
    ],
    band7PlusTargets: [
      'Sử dụng collocations chuẩn xác (vd: mitigate environmental degradation, widen socioeconomic disparities).',
      'Paraphrase linh hoạt bằng từ đồng nghĩa, đổi cấu trúc danh từ hóa (nominalization) và giữ văn phong trang trọng.',
    ],
  },
  {
    code: 'GRA',
    name: 'Grammatical Range & Accuracy',
    weight: '25%',
    focusVi:
      'Sự đa dạng cấu trúc câu phức, câu ghép, mệnh đề quan hệ, câu điều kiện, bị động và độ sạch lỗi ngữ pháp (thì, mạo từ, chia động từ).',
    band6Characteristics: [
      'Lặp đi lặp lại một kiểu câu đơn hoặc câu ghép dùng "and / but / because".',
      'Lỗi chia thì (đặc biệt quên Quá khứ đơn ở Task 1), lỗi S-V agreement hoặc comma splice (nối 2 mệnh đề bằng dấu phẩy).',
    ],
    band7PlusTargets: [
      'Kết hợp hài hòa câu phức ngắn - dài: mệnh đề nhượng bộ (While/Although), mệnh đề quan hệ rút gọn, câu chẻ (It is X that...), đảo ngữ nhẹ (Not only does...).',
      'Phần lớn câu không mắc lỗi ngữ pháp và dấu câu chuẩn xác.',
    ],
  },
];

export const TASK_1_GUIDES: Task1GuideItem[] = [
  {
    id: 'line',
    title: 'Line Graph (Biểu đồ đường)',
    titleVi: 'Xu hướng thay đổi theo thời gian (Dynamic Chart)',
    promptAnalysis: [
      'Xác định đối tượng đo lường, đơn vị (%, triệu tấn, USD) và mốc thời gian (quá khứ hay dự báo tương lai).',
      'Chia đường thành nhóm: nhóm tăng trưởng, nhóm suy giảm, nhóm dao động mạnh hoặc ổn định.',
      'Ghi chú ngay 3 điểm vàng cho Overview: xu hướng tổng thể, đường cao nhất/thấp nhất, và sự đổi ngôi nếu có.',
    ],
    structure: [
      {
        paragraph: 'Paragraph 1: Introduction (1-2 câu)',
        role: 'Paraphrase đề bài',
        tips: 'Dùng "The line graph illustrates/compares changes in... across X categories between [year] and [year]."',
      },
      {
        paragraph: 'Paragraph 2: Overview (2 câu)',
        role: 'Tóm tắt bức tranh lớn (KHÔNG ghi số liệu)',
        tips: 'Câu 1: Xu hướng chung (Overall, ... experienced an upward trend while...). Câu 2: Giá trị nổi bật nhất (In addition, X consistently recorded the highest figures).',
      },
      {
        paragraph: 'Paragraph 3: Body 1 (3-4 câu)',
        role: 'Nhóm các đường cùng xu hướng hoặc nửa giai đoạn đầu',
        tips: 'Báo cáo điểm khởi đầu, các mốc biến động bước ngoặt và điểm kết thúc bằng số liệu chính xác.',
      },
      {
        paragraph: 'Paragraph 4: Body 2 (3-4 câu)',
        role: 'Nhóm các đường còn lại & so sánh đối chiếu',
        tips: 'Dùng từ nối tương phản (Conversely, By contrast) và cấu trúc so sánh gấp bội (twice as high as).',
      },
    ],
    scoringStructures: [
      'Witnessed a pronounced surge from X in 2005 to a peak of Y in 2015, before tapering off to Z.',
      'After fluctuating moderately around X, the figure for A overtook that of B in the final decade.',
      'There was a steady upward trajectory in X, rising roughly threefold over the 20-year span.',
    ],
    keyVocabulary: [
      { term: 'witness a sharp upward trajectory', meaningVi: 'chứng kiến quỹ đạo tăng mạnh' },
      { term: 'plateau at approximately...', meaningVi: 'chững lại/đi ngang ở mức xấp xỉ...' },
      { term: 'plummet / dip / rebound', meaningVi: 'lao dốc / giảm nhẹ rồi / bật tăng trở lại' },
      { term: 'outpace / surpass', meaningVi: 'vượt qua, vượt mặt đối tượng khác' },
    ],
    miniModelSnippet:
      'Overall, renewable electricity generation followed an upward trajectory across all three nations, whereas coal consumption steadily declined. Notably, Germany consistently maintained the highest output throughout the two-decade period.',
  },
  {
    id: 'bar',
    title: 'Bar Chart (Biểu đồ cột)',
    titleVi: 'So sánh đối chiếu giữa các nhóm (Static hoặc Dynamic)',
    promptAnalysis: [
      'Kiểm tra xem biểu đồ có mốc thời gian thay đổi (Dynamic) hay chỉ tại 1 năm duy nhất (Static).',
      'Nếu là Static: tập trung ngôn ngữ so sánh hơn/nhất, xếp hạng và khoảng cách chênh lệch.',
      'Nếu là Dynamic: kết hợp mô tả xu hướng theo năm và so sánh thứ hạng giữa các cột.',
    ],
    structure: [
      {
        paragraph: 'Paragraph 1: Introduction',
        role: 'Diễn đạt lại đối tượng, trục hoành/tung và đơn vị đo',
        tips: 'Thay "shows" bằng "compares" hoặc "depicts the proportion/amount of...".',
      },
      {
        paragraph: 'Paragraph 2: Overview',
        role: 'Chỉ ra hạng mục dẫn đầu, hạng mục thấp nhất và chênh lệch đáng chú ý',
        tips: 'Nhóm các cột tương đồng để tránh liệt kê rời rạc.',
      },
      {
        paragraph: 'Paragraph 3: Body 1',
        role: 'Phân tích nhóm cột có giá trị cao / nhóm A',
        tips: 'Nêu số liệu chính xác kèm so sánh trực tiếp ("exceeded Y by 15 percentage points").',
      },
      {
        paragraph: 'Paragraph 4: Body 2',
        role: 'Phân tích nhóm cột giá trị trung bình - thấp / nhóm B',
        tips: 'So sánh tỷ lệ gấp bao nhiêu lần hoặc sự tương phản rõ rệt.',
      },
    ],
    scoringStructures: [
      'Category A accounted for the largest share at 48%, nearly double the figure recorded for Category B.',
      'While urban residents allocated 35% of spending to housing, the corresponding figure for rural households stood at merely 18%.',
      'By contrast, minimal discrepancies were observed between the two youngest age brackets.',
    ],
    keyVocabulary: [
      { term: 'the corresponding figure for...', meaningVi: 'số liệu tương ứng cho...' },
      { term: 'marginal discrepancy', meaningVi: 'sự chênh lệch không đáng kể' },
      { term: 'outnumber / dwarf', meaningVi: 'nhiều hơn hẳn / làm lu mờ' },
      { term: 'rank second after...', meaningVi: 'xếp thứ hai ngay sau...' },
    ],
    miniModelSnippet:
      'Overall, tertiary graduates outnumbered diploma holders in every surveyed sector, with engineering exhibiting the widest qualification gap between the two groups.',
  },
  {
    id: 'pie',
    title: 'Pie Chart (Biểu đồ tròn)',
    titleVi: 'Phân bổ tỷ trọng phần trăm (%) theo tổng 100%',
    promptAnalysis: [
      'Xác định tổng thể (100% đại diện cho cái gì: ngân sách quốc gia, nguồn năng lượng, chi tiêu hộ gia đình).',
      'Chú ý các lát cắt lớn nhất ("chiếm áp đảo"), lát cắt nhỏ nhất ("không đáng kể") và các lát cắt gộp.',
      'Nếu có 2-3 biểu đồ tròn theo năm: theo dõi lát cắt nào mở rộng và lát cắt nào thu hẹp.',
    ],
    structure: [
      {
        paragraph: 'Paragraph 1: Introduction',
        role: 'Nêu rõ cơ cấu phân bổ % của đối tượng',
        tips: 'Dùng "breaks down the percentage distribution of...".',
      },
      {
        paragraph: 'Paragraph 2: Overview',
        role: 'Nhấn mạnh thành phần chi phối (dominant share) và xu hướng dịch chuyển tỷ trọng',
        tips: 'Không viết số % cụ thể trong Overview.',
      },
      {
        paragraph: 'Paragraph 3: Body 1',
        role: 'Mô tả 2-3 lát cắt lớn nhất (chiếm >50-70% tổng)',
        tips: 'Dùng phân số ước lượng học thuật (nearly half, roughly a third, just over a quarter) xen kẽ số %.',
      },
      {
        paragraph: 'Paragraph 4: Body 2',
        role: 'Mô tả các lát cắt nhỏ hơn và mục "Other"',
        tips: 'Gộp các mục nhỏ bằng cấu trúc "collectively comprised..." hoặc "made up the remaining X%".',
      },
    ],
    scoringStructures: [
      'Housing and utilities jointly constituted almost two-thirds of total household expenditure.',
      'Meanwhile, leisure activities represented a negligible slice, accounting for under 5% in both years.',
      'The share of fossil fuels shrank considerably, compensated by a threefold expansion in wind power.',
    ],
    keyVocabulary: [
      { term: 'constitute / account for / comprise', meaningVi: 'chiếm tỷ trọng' },
      { term: 'account for a negligible proportion', meaningVi: 'chiếm tỷ lệ không đáng kể' },
      { term: 'jointly / collectively', meaningVi: 'gộp chung lại' },
      { term: 'the remaining X%', meaningVi: 'phần X% còn lại' },
    ],
    miniModelSnippet:
      'Overall, fossil fuels constituted the overwhelming majority of electricity generation in 2000, whereas by 2020 renewable sources had expanded substantially to challenge that dominance.',
  },
  {
    id: 'table',
    title: 'Table (Bảng số liệu)',
    titleVi: 'Xử lý bảng nhiều hàng, nhiều cột không bị ngợp dữ liệu',
    promptAnalysis: [
      'Nguyên tắc vàng: TUYỆT ĐỐI không kể lể từng ô một! Phải chọn lọc nhóm cực trị (Max/Min) và mẫu hình chung.',
      'So sánh theo hàng ngang (biến thiên thời gian) và theo cột dọc (thứ hạng giữa các quốc gia/danh mục).',
      'Khoanh tròn 6-8 con số tiêu biểu nhất trước khi bắt tay vào viết.',
    ],
    structure: [
      {
        paragraph: 'Paragraph 1: Introduction',
        role: 'Paraphrase tiêu đề bảng và các cột/đơn vị đo',
        tips: 'Dùng "The table provides statistical data regarding... across X countries/categories."',
      },
      {
        paragraph: 'Paragraph 2: Overview',
        role: 'Nêu quy luật nổi bật nhất theo hàng và cột',
        tips: 'Ví dụ: Quốc gia nào dẫn đầu hầu hết các chỉ số, chỉ số nào có biên độ chênh lệch lớn nhất.',
      },
      {
        paragraph: 'Paragraph 3: Body 1',
        role: 'Nhóm các hàng/cột đứng đầu hoặc tăng trưởng mạnh',
        tips: 'Sử dụng mệnh đề phân từ (recording..., reaching...) để lồng ghép số liệu mượt mà.',
      },
      {
        paragraph: 'Paragraph 4: Body 2',
        role: 'Nhóm các hàng/cột đứng cuối hoặc có ngoại lệ bất thường',
        tips: 'Nhấn mạnh ngoại lệ ("The sole exception to this pattern was...").',
      },
    ],
    scoringStructures: [
      'With an annual output of 120 million tonnes, Country A stood well above all other surveyed nations.',
      'Ranked in descending order, X led the table, trailed closely by Y and Z.',
      'Despite starting from a modest baseline, Sector C posted the steepest percentage gain.',
    ],
    keyVocabulary: [
      { term: 'stand well above', meaningVi: 'vượt trội hơn hẳn' },
      { term: 'trail closely behind', meaningVi: 'theo sát ngay phía sau' },
      { term: 'the sole exception to this trend', meaningVi: 'ngoại lệ duy nhất đối với xu hướng này' },
      { term: 'modest baseline', meaningVi: 'mức khởi điểm khiêm tốn' },
    ],
    miniModelSnippet:
      'Overall, high-income economies consistently registered longer average life expectancy alongside lower infant mortality, with Japan leading the table across both health indicators.',
  },
  {
    id: 'map',
    title: 'Map (Bản đồ quy hoạch)',
    titleVi: 'Mô tả sự thay đổi không gian / cơ sở hạ tầng giữa 2 mốc thời gian',
    promptAnalysis: [
      'Xác định la bàn phương hướng (North/South/East/West) và các mốc cố định làm điểm tựa (đường chính, dòng sông, bờ biển).',
      'Liệt kê nhanh 4 loại biến đổi: Xây mới (Constructed), Phá bỏ (Demolished), Mở rộng/Thu hẹp (Expanded/Shrunk), Chuyển đổi công năng (Converted into).',
      'Chú ý chia thì chuẩn: Quá khứ đơn (2 bản đồ quá khứ), Hiện tại hoàn thành (Quá khứ -> Hiện tại), Bị động tương lai/is planned to (Hiện tại -> Tương lai).',
    ],
    structure: [
      {
        paragraph: 'Paragraph 1: Introduction',
        role: 'Giới thiệu bản đồ địa điểm và hai mốc thời gian',
        tips: 'Dùng "The two maps illustrate the structural transformation of [place] between [Y1] and [Y2]."',
      },
      {
        paragraph: 'Paragraph 2: Overview',
        role: 'Đánh giá mức độ đô thị hóa / hiện đại hóa tổng quát',
        tips: 'Nêu rõ khu vực trở nên thương mại/dân cư hóa hơn và mất đi/giữ lại mảng xanh nào.',
      },
      {
        paragraph: 'Paragraph 3: Body 1',
        role: 'Mô tả sự thay đổi ở nửa Bắc hoặc khu vực Trung tâm / Tây',
        tips: 'Liên kết vị trí không gian chặt chẽ (To the north of..., Adjacent to..., Running along...).',
      },
      {
        paragraph: 'Paragraph 4: Body 2',
        role: 'Mô tả nửa Nam / khu vực Đông và hệ thống giao thông',
        tips: 'Đề cập rõ những hạng mục giữ nguyên không đổi ("remained intact/unchanged").',
      },
    ],
    scoringStructures: [
      'The farmland in the northeast corner was cleared to make way for a multi-storey car park.',
      'Adjacent to the main railway line, the former warehouse has been converted into a public art gallery.',
      'While the southern coastline underwent extensive commercialization, the central botanical garden remained largely intact.',
    ],
    keyVocabulary: [
      { term: 'make way for / give way to', meaningVi: 'nhường chỗ cho công trình mới' },
      { term: 'be converted / repurposed into', meaningVi: 'được cải tạo chuyển đổi thành' },
      { term: 'remain intact / unaltered', meaningVi: 'vẫn giữ nguyên vẹn' },
      { term: 'adjacent to / in the vicinity of', meaningVi: 'nằm liền kề / ở vùng lân cận của' },
    ],
    miniModelSnippet:
      'Overall, the coastal town underwent considerable modernization over the 30-year span, shifting from a quiet fishing settlement into a tourist-oriented hub with upgraded transport links.',
  },
  {
    id: 'process',
    title: 'Process Diagram (Quy trình)',
    titleVi: 'Quy trình sản xuất nhân tạo (Linear) hoặc Chu trình tự nhiên (Cyclical)',
    promptAnalysis: [
      'Đếm tổng số bước (stages), xác định điểm bắt đầu và sản phẩm đầu ra cuối cùng.',
      'Quy trình nhân tạo: BẮT BUỘC ưu tiên dùng Câu Bị Động (Present Simple Passive: is sorted, are crushed) để đạt văn phong khách quan.',
      'Chu trình tự nhiên (vòng đời động vật, vòng tuần hoàn nước): ưu tiên Chủ động + Bị động linh hoạt.',
    ],
    structure: [
      {
        paragraph: 'Paragraph 1: Introduction',
        role: 'Giới thiệu quy trình sản xuất hoặc chu trình tự nhiên',
        tips: 'Dùng "The diagram illustrates the sequential stages involved in manufacturing/producing..."',
      },
      {
        paragraph: 'Paragraph 2: Overview',
        role: 'Nêu tổng số bước, điểm khởi đầu và kết thúc (hoặc tính tuần hoàn)',
        tips: 'Ví dụ: "Overall, the linear process comprises eight distinct stages, beginning with... and culminating in..."',
      },
      {
        paragraph: 'Paragraph 3: Body 1',
        role: 'Mô tả nửa đầu quy trình (từ nguyên liệu thô tới xử lý trung gian)',
        tips: 'Dùng từ nối trình tự tự nhiên (Initially, Once..., Subsequently, Following this step).',
      },
      {
        paragraph: 'Paragraph 4: Body 2',
        role: 'Mô tả nửa sau quy trình tới thành phẩm / đóng gói / phân phối',
        tips: 'Kết hợp mệnh đề rút gọn ("Once sorted, the glass fragments are melted...").',
      },
    ],
    scoringStructures: [
      'Once harvested, the raw beans are sun-dried for up to five days before being transported to a processing plant.',
      'At the subsequent stage, impurities are filtered out via a pressurized cylindrical sieve.',
      'The process culminates in automated packaging, after which finished goods are dispatched to retail outlets.',
    ],
    keyVocabulary: [
      { term: 'sequential stages', meaningVi: 'các giai đoạn nối tiếp nhau' },
      { term: 'culminate in', meaningVi: 'kết thúc / đạt tới bước cuối là' },
      { term: 'undergo mechanical sorting', meaningVi: 'trải qua quá trình phân loại cơ học' },
      { term: 'be dispatched to', meaningVi: 'được vận chuyển phân phối tới' },
    ],
    miniModelSnippet:
      'Overall, the recycling of glass bottles is a closed-loop process consisting of six main stages, commencing with household collection and culminating in the molding of new containers for retail distribution.',
  },
];

export const TASK_2_GUIDES: Task2GuideItem[] = [
  {
    id: 'opinion',
    title: 'Opinion (Agree or Disagree)',
    titleVi: 'Dạng đồng ý hay không đồng ý ("To what extent do you agree or disagree?")',
    recognitionCue:
      'Đề đưa ra 1 nhận định duy nhất và hỏi: "Do you agree or disagree?" hoặc "To what extent do you agree or disagree?".',
    promptAnalysis: [
      'Chọn lập trường dứt khoát ngay từ đầu: Đồng ý hoàn toàn, Phản đối hoàn toàn, hoặc Đồng ý một phần (Balanced: đồng ý mặt A nhưng nhấn mạnh điều kiện B).',
      'Tránh viết kiểu "nước đôi" mơ hồ khiến người đọc không rõ bạn nghiêng về phía nào.',
    ],
    structure: [
      {
        paragraph: 'Introduction (2 câu)',
        role: 'Paraphrase nhận định + Thesis Statement nêu lập trường trực diện',
        tips: 'Dùng "While X offers certain merits, I strongly contend that..." hoặc "I completely concur with this perspective because..."',
      },
      {
        paragraph: 'Body Paragraph 1 (PEEL)',
        role: 'Luận điểm chính thứ 1 bảo vệ quan điểm (hoặc nhượng bộ phản biện nếu viết Balanced)',
        tips: 'Point -> Explain cơ chế nguyên nhân/kết quả -> Example cụ thể -> Link quay lại đề.',
      },
      {
        paragraph: 'Body Paragraph 2 (PEEL)',
        role: 'Luận điểm chính thứ 2 mạnh hơn / lý do quyết định lập trường của bạn',
        tips: 'Không lặp lại ý Body 1; mở rộng sang góc độ kinh tế, xã hội hoặc dài hạn.',
      },
      {
        paragraph: 'Conclusion (2 câu)',
        role: 'Khẳng định lại lập trường bằng từ ngữ mới + khuyến nghị ngắn (không thêm ý mới)',
        tips: 'Dùng "In conclusion, I firmly believe that..."',
      },
    ],
    scoringStructures: [
      'Although critics argue that X imposes short-term costs, its long-term societal dividends far outweigh this concern.',
      'Not only does this approach alleviate financial strain, but it also fosters greater social cohesion.',
      'Were governments to neglect this responsibility, existing inequalities would inevitably widen.',
    ],
    commonTraps: [
      'Không nêu rõ mức độ đồng ý trong Introduction và Conclusion.',
      'Đưa quá 3 ý vụn vặt vào một đoạn Body khiến mỗi ý chỉ dài 1-2 câu, thiếu chiều sâu (bị chặn Band 6.0 ở tiêu chí TR).',
    ],
    miniModelSnippet:
      'While free university tuition undeniably expands educational access for low-income youth, I largely disagree with universal subsidies because public funds can yield higher returns when targeted through needs-based scholarships.',
  },
  {
    id: 'discussion',
    title: 'Discussion (Discuss Both Views & Give Your Opinion)',
    titleVi: 'Thảo luận hai luồng quan điểm trái chiều và đưa ra ý kiến cá nhân',
    recognitionCue:
      'Đề có 2 quan điểm đối lập ("Some people believe X, while others think Y. Discuss both these views and give your own opinion.").',
    promptAnalysis: [
      'Bắt buộc phân tích CẢ HAI quan điểm một cách công bằng (mỗi quan điểm 1 đoạn Body), dù bạn ủng hộ bên nào.',
      'Ý kiến cá nhân phải xuất hiện rõ ràng ở Thesis Statement và được nhấn mạnh lại ở Body 2 + Conclusion.',
    ],
    structure: [
      {
        paragraph: 'Introduction (2-3 câu)',
        role: 'Paraphrase 2 quan điểm + Nêu rõ bạn nghiêng về quan điểm nào',
        tips: '"This essay will examine both arguments before explaining why I align with the latter view."',
      },
      {
        paragraph: 'Body Paragraph 1 (Quan điểm bạn KHÔNG ưu tiên)',
        role: 'Phân tích lý do vì sao nhiều người ủng hộ quan điểm thứ nhất',
        tips: 'Dùng ngôn ngữ khách quan: "Proponents of the former view contend that..."',
      },
      {
        paragraph: 'Body Paragraph 2 (Quan điểm bạn ỦNG HỘ)',
        role: 'Phân tích sức thuyết phục vượt trội của quan điểm thứ hai + lý do cá nhân',
        tips: 'Dùng "Nevertheless, I am inclined to support the view that..."',
      },
      {
        paragraph: 'Conclusion (2 câu)',
        role: 'Tóm tắt 2 góc nhìn và tái khẳng định quan điểm của bản thân',
        tips: 'Tránh copy nguyên câu thesis từ mở bài.',
      },
    ],
    scoringStructures: [
      'Advocates of stricter regulation emphasize public safety, pointing to...',
      'Conversely, those who champion individual autonomy maintain that...',
      'On balance, while the former stance carries merit in the short term, the latter provides a more sustainable framework.',
    ],
    commonTraps: [
      'Quên đưa ra quan điểm cá nhân (chỉ bàn 2 chiều mà không chốt lập trường -> mất điểm Task Response nặng).',
      'Viết thiên lệch quá mức (Body 1 chỉ 2 dòng, Body 2 dài 12 dòng).',
    ],
    miniModelSnippet:
      'Admittedly, prioritizing local job protection carries intuitive appeal during economic downturns; however, I contend that embracing international trade ultimately generates broader consumer welfare and technological innovation.',
  },
  {
    id: 'adv_disadv',
    title: 'Advantages & Disadvantages',
    titleVi: 'Phân tích Lợi ích & Bất cập (hoặc "Do advantages outweigh disadvantages?")',
    recognitionCue:
      'Đề hỏi "Discuss the advantages and disadvantages" HOẶC "Do the advantages of this trend outweigh the disadvantages?".',
    promptAnalysis: [
      'Phân biệt kỹ 2 biến thể: Nếu đề hỏi "Discuss advantages and disadvantages", chỉ cần phân tích đều hai mặt. Nếu hỏi "Outweigh?", BẮT BUỘC phải khẳng định bên nào nặng ký hơn!',
    ],
    structure: [
      {
        paragraph: 'Introduction',
        role: 'Giới thiệu xu hướng + Trả lời thẳng bên nào trội hơn (nếu có từ "outweigh")',
        tips: '"Although this shift brings notable drawbacks, I believe its long-term advantages decisively outweigh them."',
      },
      {
        paragraph: 'Body Paragraph 1',
        role: 'Phân tích 2 lợi ích chính (hoặc 2 bất cập nếu bạn chọn chiều ngược lại)',
        tips: 'Nên đặt phía ít trọng tâm hơn ở Body 1 để Body 2 tạo điểm nhấn thuyết phục cho kết luận.',
      },
      {
        paragraph: 'Body Paragraph 2',
        role: 'Phân tích 2 điểm đối trọng và lý giải vì sao chúng có tác động sâu rộng hơn',
        tips: 'So sánh trực tiếp tầm ảnh hưởng (vd: lợi ích mang tính cấu trúc lâu dài vs bất cập có thể kiểm soát).',
      },
      {
        paragraph: 'Conclusion',
        role: 'Tóm tắt lợi ích/hạn chế và chốt lại câu hỏi Outweigh',
        tips: 'Nhất quán hoàn toàn với Introduction.',
      },
    ],
    scoringStructures: [
      'Chief among the drawbacks of this phenomenon is..., which undermines...',
      'However, these concerns are largely eclipsed by the substantial efficiency gains achieved through...',
      'Provided that appropriate safeguards are enacted, the net impact remains overwhelmingly positive.',
    ],
    commonTraps: [
      'Bỏ sót chữ "outweigh" nên viết cả 2 đoạn ngang nhau không kết luận bên nào thắng thế.',
      'Chỉ liệt kê danh sách gạch đầu dòng 4-5 lợi ích mà không phân tích sâu bất kỳ ý nào.',
    ],
    miniModelSnippet:
      'While remote employment can blur work-life boundaries and weaken team camaraderie, these manageable drawbacks are eclipsed by substantial reductions in commuting emissions and wider access to global talent.',
  },
  {
    id: 'problem_solution',
    title: 'Problem / Causes & Solutions',
    titleVi: 'Xác định Nguyên nhân / Hệ lụy và Đề xuất Giải pháp tương ứng',
    recognitionCue:
      'Đề mô tả một hiện tượng tiêu cực và hỏi: "What are the causes/problems? What solutions can be suggested?".',
    promptAnalysis: [
      'Nguyên tắc đối xứng (Alignment): Giải pháp ở Body 2 PHẢI giải quyết trực tiếp nguyên nhân/vấn đề đã nêu ở Body 1.',
      'Nêu rõ chủ thể thực hiện giải pháp (Chính phủ, Doanh nghiệp, Nhà trường, Cá nhân) và cơ chế khả thi.',
    ],
    structure: [
      {
        paragraph: 'Introduction',
        role: 'Paraphrase thực trạng vấn đề + Nêu rõ bài viết sẽ phân tích nguyên nhân/hệ lụy và giải pháp',
        tips: '"This escalation stems from several underlying factors, yet targeted interventions can effectively reverse the trend."',
      },
      {
        paragraph: 'Body Paragraph 1: Causes / Problems',
        role: 'Phân tích 2 nguyên nhân gốc rễ (hoặc 2 hệ lụy nghiêm trọng) kèm giải thích',
        tips: 'Dùng chuỗi động từ nhân-quả: stem from, precipitate, give rise to, exacerbate.',
      },
      {
        paragraph: 'Body Paragraph 2: Solutions',
        role: 'Đề xuất 2 giải pháp cụ thể giải quyết trực tiếp 2 ý ở Body 1',
        tips: 'Tránh giải pháp chung chung sáo rỗng ("the government should raise awareness"); hãy nêu cách làm cụ thể (thuế, trợ cấp, cải cách chương trình học).',
      },
      {
        paragraph: 'Conclusion',
        role: 'Tóm tắt nguyên nhân cốt lõi & nhấn mạnh sự phối hợp hành động để giải quyết',
        tips: 'Ngắn gọn, dứt khoát (2 câu).',
      },
    ],
    scoringStructures: [
      'A primary catalyst behind this trend is..., which compels individuals to...',
      'To counteract this issue, municipal authorities ought to implement stricter zoning laws alongside financial incentives.',
      'Only through a coordinated effort between public regulators and private enterprises can this bottleneck be resolved.',
    ],
    commonTraps: [
      'Giải pháp không ăn khớp với nguyên nhân (Body 1 nói nguyên nhân do thiếu tiền, Body 2 lại khuyên tuyên truyền giáo dục).',
      'Viết giải pháp quá viển vông hoặc dùng mệnh lệnh thức ("Governments must...").',
    ],
    miniModelSnippet:
      'A key driver of urban traffic congestion is underinvestment in reliable mass transit; consequently, reallocating fuel-tax revenues toward dedicated bus lanes and suburban rail links offers the most pragmatic remedy.',
  },
  {
    id: 'two_part',
    title: 'Two-Part Question (Direct Questions)',
    titleVi: 'Đề gồm hai câu hỏi trực tiếp độc lập hoặc liên kết nhau',
    recognitionCue:
      'Đề đưa ra một nhận định/xu hướng và đặt 2 câu hỏi riêng biệt (vd: "Why is this happening? Is this a positive or negative development?").',
    promptAnalysis: [
      'Mỗi câu hỏi tương ứng trọn vẹn 1 đoạn Body (Body 1 trả lời Câu hỏi 1, Body 2 trả lời Câu hỏi 2).',
      'Trả lời tóm tắt CẢ HAI câu hỏi ngay trong Thesis Statement của mở bài.',
    ],
    structure: [
      {
        paragraph: 'Introduction',
        role: 'Paraphrase bối cảnh + Trả lời ngắn gọn cả 2 câu hỏi trong Thesis',
        tips: '"This shift is largely driven by X, and I view it as a predominantly positive development because of Y."',
      },
      {
        paragraph: 'Body Paragraph 1',
        role: 'Trả lời đầy đủ Câu hỏi 1 với 2 luận điểm phát triển sâu',
        tips: 'Bám sát đúng trọng tâm câu hỏi 1 (vd: Tại sao xu hướng này diễn ra?).',
      },
      {
        paragraph: 'Body Paragraph 2',
        role: 'Trả lời đầy đủ Câu hỏi 2 với lập luận rõ ràng và ví dụ minh họa',
        tips: 'Đảm bảo đánh giá đúng góc độ câu hỏi 2 (vd: Tích cực hay tiêu cực?).',
      },
      {
        paragraph: 'Conclusion',
        role: 'Tổng hợp câu trả lời cho cả 2 câu hỏi bằng cách diễn đạt mới',
        tips: 'Kiểm tra lại xem có câu hỏi nào bị trả lời hời hợt không.',
      },
    ],
    scoringStructures: [
      'Several socioeconomic forces account for this shift, foremost among which is...',
      'Evaluating its broader impact, this trend represents a welcome progression insofar as it empowers...',
      'Nevertheless, unchecked expansion could pose risks unless accompanied by transparent oversight.',
    ],
    commonTraps: [
      'Chỉ trả lời kỹ câu hỏi 1 và viết qua loa câu hỏi 2 (khiến Task Response bị kẹt ở Band 5.5 - 6.0).',
      'Thesis Statement quên nhắc tới câu trả lời cho câu hỏi thứ hai.',
    ],
    miniModelSnippet:
      'The growing preference for delayed parenthood stems primarily from rising living costs and extended career preparation; overall, this represents a constructive trend because financially stable households can invest more deliberately in child development.',
  },
];

export const IDEA_BANK_TOPICS: IdeaBankTopic[] = [
  'Education',
  'Technology',
  'Environment',
  'Health',
  'Work',
  'Society',
  'Government',
  'Culture',
];

export const IDEA_BANK_ENTRIES: IdeaBankEntry[] = [
  // EDUCATION (3)
  {
    id: 'idea-edu-1',
    topic: 'Education',
    essayType: 'Opinion',
    prompt:
      'University education should be free for all students regardless of their financial background.',
    promptSummaryVi: 'Giáo dục đại học nên miễn phí hoàn toàn cho mọi sinh viên.',
    sideATitle: 'Ủng hộ miễn học phí đại học (Equity & Talent)',
    sideAArguments: [
      'Loại bỏ rào cản tài chính cho sinh viên thu nhập thấp, thúc đẩy dịch chuyển xã hội công bằng (upward social mobility).',
      'Sinh viên tốt nghiệp không gánh nợ học phí (student debt) sẽ sẵn sàng khởi nghiệp, nghiên cứu khoa học hoặc làm việc ở khu vực công.',
    ],
    sideBTitle: 'Phản đối miễn phí đại trà (Fiscal Burden & Quality)',
    sideBArguments: [
      'Tạo áp lực ngân sách nặng nề, buộc nhà nước phải tăng thuế hoặc cắt giảm chi tiêu cho y tế và giáo dục phổ thông.',
      'Học bổng theo hoàn cảnh (means-tested scholarships) công bằng hơn vì tránh trợ cấp bằng tiền thuế cho các gia đình giàu có.',
    ],
    examples: [
      'Đức và các nước Bắc Âu duy trì miễn học phí công lập nhờ thuế suất cao, trong khi Úc dùng hệ thống cho vay hoàn trả theo thu nhập (HECS-HELP).',
    ],
    collocations: [
      { phrase: 'upward social mobility', meaningVi: 'sự dịch chuyển thăng tiến xã hội' },
      { phrase: 'means-tested scholarships', meaningVi: 'học bổng xét theo điều kiện tài chính' },
      { phrase: 'prohibitive tuition fees', meaningVi: 'mức học phí đắt đỏ đến mức cản trở' },
      { phrase: 'strain public coffers', meaningVi: 'gây áp lực lên ngân sách nhà nước' },
    ],
  },
  {
    id: 'idea-edu-2',
    topic: 'Education',
    essayType: 'Discussion',
    prompt:
      'Some people believe schools should focus strictly on academic subjects, while others think practical life skills should be prioritized.',
    promptSummaryVi: 'Trường học nên tập trung môn học thuật hay kỹ năng sống thực tiễn?',
    sideATitle: 'Ưu tiên môn học thuật (Academic Rigour)',
    sideAArguments: [
      'Toán học, khoa học và ngôn ngữ xây dựng tư duy phân tích nền tảng để tiếp cận các ngành nghề chuyên môn cao.',
      'Kỳ thi tuyển sinh đại học và chuẩn đánh giá quốc tế vẫn lấy năng lực học thuật làm thước đo cốt lõi.',
    ],
    sideBTitle: 'Ưu tiên kỹ năng thực tiễn (Practical Readiness)',
    sideBArguments: [
      'Quản lý tài chính cá nhân, sơ cứu y tế và tư duy số giúp học sinh thích nghi ngay với đời sống trưởng thành.',
      'Giảm tỷ lệ thanh niên thiếu kỹ năng sinh tồn cơ bản dù sở hữu bằng cấp cao.',
    ],
    examples: [
      'Phần Lan tích hợp các tiết học kinh tế gia đình và quản lý ngân sách cá nhân ngay từ bậc trung học cơ sở.',
    ],
    collocations: [
      { phrase: 'holistic curriculum', meaningVi: 'chương trình học toàn diện' },
      { phrase: 'financial literacy', meaningVi: 'kiến thức quản lý tài chính cá nhân' },
      { phrase: 'analytical reasoning', meaningVi: 'năng lực lập luận phân tích' },
      { phrase: 'vocational readiness', meaningVi: 'sự sẵn sàng cho nghề nghiệp thực tế' },
    ],
  },
  {
    id: 'idea-edu-3',
    topic: 'Education',
    essayType: 'Advantage/Disadvantage',
    prompt:
      'Online degree programs and remote classrooms are increasingly replacing traditional campus-based learning.',
    promptSummaryVi: 'Lợi ích và hạn chế của việc học trực tuyến thay thế lớp học truyền thống.',
    sideATitle: 'Lợi ích (Flexibility & Cost Efficiency)',
    sideAArguments: [
      'Xóa bỏ rào cản địa lý, cho phép học viên vùng sâu hoặc người đi làm tiếp cận giáo trình chuẩn quốc tế.',
      'Tiết kiệm đáng kể chi phí đi lại, ký túc xá và vận hành cơ sở vật chất.',
    ],
    sideBTitle: 'Bất cập (Isolation & Inequality)',
    sideBArguments: [
      'Thiếu tương tác trực diện làm giảm động lực học tập, kỹ năng làm việc nhóm và thực hành thí nghiệm.',
      'Khoét sâu bất bình đẳng số (digital divide) đối với học sinh thiếu kết nối Internet ổn định.',
    ],
    examples: [
      'Các nền tảng MOOC như Coursera giúp hàng triệu học viên tự học khoa học dữ liệu nhưng tỷ lệ hoàn thành khóa học không giám sát thường dưới 15%.',
    ],
    collocations: [
      { phrase: 'digital divide', meaningVi: 'khoảng cách bất bình đẳng công nghệ số' },
      { phrase: 'self-paced learning', meaningVi: 'học tập theo nhịp độ tự chủ' },
      { phrase: 'peer-to-peer interaction', meaningVi: 'tương tác giữa các học viên với nhau' },
      { phrase: 'geographical barriers', meaningVi: 'rào cản về mặt địa lý' },
    ],
  },
  // TECHNOLOGY (3)
  {
    id: 'idea-tech-1',
    topic: 'Technology',
    essayType: 'Two-part Question',
    prompt:
      'Artificial intelligence is automating routine tasks across many industries. Why is this happening, and is it a positive or negative development?',
    promptSummaryVi: 'Vì sao AI tự động hóa nhiều công việc và đây là xu hướng tích cực hay tiêu cực?',
    sideATitle: 'Nguyên nhân thúc đẩy (Drivers of Automation)',
    sideAArguments: [
      'Doanh nghiệp cắt giảm chi phí nhân công dài hạn, hạn chế sai sót thủ công và vận hành liên tục 24/7.',
      'Năng lực xử lý dữ liệu lớn và học máy (machine learning) phát triển vượt bậc.',
    ],
    sideBTitle: 'Đánh giá tác động (Mixed / Conditionally Positive)',
    sideBArguments: [
      'Tích cực: Giải phóng con người khỏi công việc lặp lại nguy hiểm, tăng năng suất kinh tế và hỗ trợ chẩn đoán y khoa.',
      'Tiêu cực nếu thiếu quản lý: Gây thất nghiệp cơ cấu (structural unemployment) cho lao động phổ thông không kịp tái đào tạo.',
    ],
    examples: [
      'Hệ thống AI hỗ trợ bác sĩ X-quang phát hiện sớm khối u với độ nhạy cao, trong khi dây chuyền lắp ráp tự động làm giảm nhu cầu lao động giản đơn.',
    ],
    collocations: [
      { phrase: 'structural unemployment', meaningVi: 'thất nghiệp do thay đổi cơ cấu ngành nghề' },
      { phrase: 'routine cognitive tasks', meaningVi: 'các tác vụ lặp đi lặp lại mang tính quy trình' },
      { phrase: 'reskilling initiatives', meaningVi: 'các sáng kiến đào tạo lại kỹ năng nghề' },
      { phrase: 'operational efficiency', meaningVi: 'hiệu suất vận hành' },
    ],
  },
  {
    id: 'idea-tech-2',
    topic: 'Technology',
    essayType: 'Opinion',
    prompt:
      'Social media platforms do more harm than good to interpersonal relationships and mental well-being.',
    promptSummaryVi: 'Mạng xã hội gây hại nhiều hơn lợi cho quan hệ xã hội và sức khỏe tinh thần.',
    sideATitle: 'Gây hại (Comparison & Fragmented Attention)',
    sideAArguments: [
      'Thuật toán tối ưu hóa thời gian xem gây nghiện, làm giảm tương tác chất lượng ngoài đời thực.',
      'So sánh xã hội liên tục với hình ảnh đã qua chỉnh sửa làm gia tăng lo âu và mặc cảm ở thanh thiếu niên.',
    ],
    sideBTitle: 'Mang lại giá trị (Connectivity & Community)',
    sideBArguments: [
      'Giúp duy trì gắn kết gia đình xuyên biên giới và kết nối những cộng đồng có chung sở thích học thuật.',
      'Tác hại phần lớn bắt nguồn từ cách sử dụng thiếu kiểm soát chứ không nằm ở bản thân công cụ.',
    ],
    examples: [
      'Nhiều khảo sát tâm lý học đường ghi nhận học sinh dùng mạng xã hội trên 4 giờ/ngày có tỷ lệ rối loạn giấc ngủ cao hơn rõ rệt.',
    ],
    collocations: [
      { phrase: 'algorithmic echo chambers', meaningVi: 'buồng vang thuật toán (chỉ tiếp xúc quan điểm một chiều)' },
      { phrase: 'superficial connectivity', meaningVi: 'sự kết nối hời hợt bề nổi' },
      { phrase: 'chronic sleep deprivation', meaningVi: 'tình trạng thiếu ngủ kéo dài' },
      { phrase: 'digital hygiene', meaningVi: 'thói quen sử dụng thiết bị số lành mạnh' },
    ],
  },
  {
    id: 'idea-tech-3',
    topic: 'Technology',
    essayType: 'Problem/Solution',
    prompt:
      'The rapid collection of personal data by digital companies raises serious privacy concerns.',
    promptSummaryVi: 'Rủi ro lộ lọt dữ liệu cá nhân từ công ty công nghệ và giải pháp bảo vệ.',
    sideATitle: 'Vấn đề & Hệ lụy (Surveillance & Cybercrime)',
    sideAArguments: [
      'Dữ liệu hành vi bị bán cho bên thứ ba phục vụ quảng cáo thao túng hoặc lừa đảo tài chính.',
      'Điều khoản sử dụng dài dòng khiến người dùng bấm đồng ý mà không thực sự hiểu quyền riêng tư bị thu thập.',
    ],
    sideBTitle: 'Giải pháp khắc phục (Legislation & Encryption)',
    sideBArguments: [
      'Chính phủ ban hành khung pháp lý nghiêm ngặt phạt nặng hành vi rò rỉ dữ liệu (tương tự GDPR của châu Âu).',
      'Bắt buộc chuẩn hóa xác thực đa lớp, mã hóa đầu cuối và minh bạch nút từ chối theo dõi (opt-out).',
    ],
    examples: [
      'Quy định Bảo vệ Dữ liệu Chung (GDPR) tại EU buộc các tập đoàn công nghệ xin chấp thuận rõ ràng trước khi lưu cookie theo dõi.',
    ],
    collocations: [
      { phrase: 'informed consent', meaningVi: 'sự đồng thuận trên cơ sở hiểu rõ thông tin' },
      { phrase: 'stringent data governance', meaningVi: 'quy định quản trị dữ liệu nghiêm ngặt' },
      { phrase: 'intrusive surveillance', meaningVi: 'sự giám sát xâm phạm đời tư' },
      { phrase: 'malicious data breaches', meaningVi: 'các vụ xâm nhập đánh cắp dữ liệu ác ý' },
    ],
  },
  // ENVIRONMENT (3)
  {
    id: 'idea-env-1',
    topic: 'Environment',
    essayType: 'Discussion',
    prompt:
      'Some believe individuals can do little to stop climate change and only governments and large corporations have the power to act.',
    promptSummaryVi: 'Cá nhân có vai trò gì trước biến đổi khí hậu hay chỉ chính phủ & tập đoàn mới tạo khác biệt?',
    sideATitle: 'Vai trò quyết định của Chính phủ & Tập đoàn',
    sideAArguments: [
      'Phần lớn khí thải toàn cầu xuất phát từ sản xuất năng lượng, công nghiệp nặng và vận tải hàng loạt.',
      'Chỉ nhà nước mới đủ quyền ban hành thuế carbon, tiêu chuẩn khí thải và đầu tư lưới điện tái tạo quốc gia.',
    ],
    sideBTitle: 'Tác động cộng hưởng từ Cá nhân',
    sideBArguments: [
      'Thói quen tiêu dùng xanh (giảm thịt đỏ, đi phương tiện công cộng, hạn chế nhựa dùng một lần) tạo áp lực buộc doanh nghiệp chuyển đổi.',
      'Lá phiếu bầu cử và sự lên tiếng của công dân thúc đẩy chính trị gia thông qua luật môi trường.',
    ],
    examples: [
      'Lệnh đánh thuế túi ni-lông ở Anh kết hợp với ý thức mang túi vải của người dân đã giúp giảm hơn 95% lượng túi nhựa dùng một lần tại siêu thị.',
    ],
    collocations: [
      { phrase: 'mitigate carbon footprint', meaningVi: 'giảm thiểu dấu chân carbon' },
      { phrase: 'industrial-scale emissions', meaningVi: 'lượng phát thải ở quy mô công nghiệp' },
      { phrase: 'consumer-driven shift', meaningVi: 'sự chuyển dịch do người tiêu dùng dẫn dắt' },
      { phrase: 'enforceable environmental mandates', meaningVi: 'các quy định môi trường có tính cưỡng chế' },
    ],
  },
  {
    id: 'idea-env-2',
    topic: 'Environment',
    essayType: 'Problem/Solution',
    prompt:
      'Plastic pollution in oceans and waterways has reached critical levels. Discuss the causes and practical solutions.',
    promptSummaryVi: 'Nguyên nhân ô nhiễm rác thải nhựa đại dương và giải pháp thực tế.',
    sideATitle: 'Nguyên nhân (Single-use Culture & Weak Recycling)',
    sideAArguments: [
      'Chi phí sản xuất nhựa nguyên sinh rẻ hơn nhựa tái chế khiến ngành bao bì ưu tiên nhựa dùng một lần.',
      'Hạ tầng thu gom phân loại rác tại nguồn ở nhiều đô thị đang phát triển còn thiếu đồng bộ.',
    ],
    sideBTitle: 'Giải pháp (Circular Economy & Extended Responsibility)',
    sideBArguments: [
      'Áp dụng Trách nhiệm mở rộng của nhà sản xuất (EPR): buộc doanh nghiệp đồ uống thu hồi và tái chế vỏ chai.',
      'Cấm bao bì nhựa không thiết yếu và trợ giá vật liệu sinh học phân hủy nhanh.',
    ],
    examples: [
      'Mô hình hoàn tiền đặt cọc vỏ chai (deposit-return scheme) tại Đức đạt tỷ lệ thu hồi chai nhựa lên tới trên 95%.',
    ],
    collocations: [
      { phrase: 'single-use packaging', meaningVi: 'bao bì dùng một lần' },
      { phrase: 'marine ecosystem degradation', meaningVi: 'suy thoái hệ sinh thái biển' },
      { phrase: 'circular economy model', meaningVi: 'mô hình kinh tế tuần hoàn' },
      { phrase: 'biodegradable alternatives', meaningVi: 'vật liệu thay thế có khả năng phân hủy sinh học' },
    ],
  },
  {
    id: 'idea-env-3',
    topic: 'Environment',
    essayType: 'Opinion',
    prompt:
      'Protecting endangered animal species is a waste of resources when millions of humans still suffer from poverty.',
    promptSummaryVi: 'Có nên dồn ngân sách bảo tồn động vật quý hiếm khi con người còn nghèo đói?',
    sideATitle: 'Quan điểm phản đối bảo tồn tốn kém (Immediate Human Needs)',
    sideAArguments: [
      'Nước sạch, an ninh lương thực và chăm sóc y tế cơ bản là quyền sinh tồn cấp bách của con người.',
    ],
    sideBTitle: 'Phản bác: Bảo tồn động vật chính là bảo vệ sinh kế con người',
    sideBArguments: [
      'Đa dạng sinh học duy trì cân bằng chuỗi thức ăn, thụ phấn nông nghiệp và lọc nước tự nhiên — trực tiếp nuôi sống cộng đồng nghèo.',
      'Du lịch sinh thái bền vững mang lại nguồn thu nhập ổn định cho cư dân địa phương.',
    ],
    examples: [
      'Sự suy giảm quần thể ong thụ phấn đe dọa trực tiếp sản lượng cây ăn quả và thu nhập của hàng triệu nông dân nhỏ lẻ.',
    ],
    collocations: [
      { phrase: 'delicate ecological balance', meaningVi: 'sự cân bằng sinh thái mong manh' },
      { phrase: 'irreversible biodiversity loss', meaningVi: 'sự mất đa dạng sinh học không thể đảo ngược' },
      { phrase: 'mutually reinforcing goals', meaningVi: 'các mục tiêu bổ trợ lẫn nhau' },
      { phrase: 'sustainable ecotourism', meaningVi: 'du lịch sinh thái bền vững' },
    ],
  },
  // HEALTH (3)
  {
    id: 'idea-health-1',
    topic: 'Health',
    essayType: 'Problem/Solution',
    prompt:
      'Sedentary lifestyles and processed diets are causing rising obesity rates globally. What are the causes and solutions?',
    promptSummaryVi: 'Lối sống ít vận động và béo phì gia tăng: Nguyên nhân & Giải pháp.',
    sideATitle: 'Nguyên nhân (Desk Jobs & Ultra-Processed Food)',
    sideAArguments: [
      'Lao động văn phòng kéo dài cùng thói quen giải trí màn hình làm giảm tiêu hao năng lượng.',
      'Thức ăn nhanh giàu đường/chất béo bão hòa rẻ, tiện lợi và được quảng cáo rầm rộ hơn thực phẩm tươi.',
    ],
    sideBTitle: 'Giải pháp (Sugar Tax & Active Urban Design)',
    sideBArguments: [
      'Đánh thuế đồ uống nhiều đường để giảm tiêu thụ và lấy ngân sách tài trợ bữa ăn học đường lành mạnh.',
      'Quy hoạch đô thị ưu tiên làn xe đạp, công viên đi bộ an toàn và gắn nhãn dinh dưỡng rõ ràng.',
    ],
    examples: [
      'Thuế đường (Soft Drinks Industry Levy) tại Anh đã thúc đẩy nhiều hãng nước giải khát chủ động giảm hàm lượng đường trong công thức.',
    ],
    collocations: [
      { phrase: 'sedentary office routines', meaningVi: 'thói quen làm việc văn phòng ít vận động' },
      { phrase: 'ultra-processed foods', meaningVi: 'thực phẩm siêu chế biến' },
      { phrase: 'cardiovascular ailments', meaningVi: 'các bệnh lý về tim mạch' },
      { phrase: 'preventive public health', meaningVi: 'y tế dự phòng cộng đồng' },
    ],
  },
  {
    id: 'idea-health-2',
    topic: 'Health',
    essayType: 'Opinion',
    prompt:
      'Governments should spend more money on preventing diseases than on treating people who are already ill.',
    promptSummaryVi: 'Chính phủ nên đầu tư cho phòng bệnh hơn chữa bệnh?',
    sideATitle: 'Đồng ý mạnh mẽ (Cost-Effectiveness & Quality of Life)',
    sideAArguments: [
      'Tiêm chủng, tầm soát sớm và giáo dục dinh dưỡng giúp ngăn chặn bệnh mãn tính trước khi đòi hỏi phẫu thuật hoặc nằm viện tốn kém.',
      'Giảm quá tải bệnh viện công và kéo dài số năm sống khỏe mạnh của lực lượng lao động.',
    ],
    sideBTitle: 'Cân bằng điều trị cấp cứu (Essential Curative Care)',
    sideBArguments: [
      'Không thể cắt giảm ngân sách cấp cứu, điều trị ung thư hay chấn thương vì đây là trách nhiệm nhân đạo tối thiểu.',
      'Phòng ngừa là chiến lược dài hạn nhưng cần duy trì song song nền tảng điều trị vững chắc.',
    ],
    examples: [
      'Chiến dịch tầm soát sớm và tiêm phòng vaccine giảm tỷ lệ nhập viện và tiết kiệm hàng tỷ USD chi phí y tế mỗi năm.',
    ],
    collocations: [
      { phrase: 'preventive healthcare initiatives', meaningVi: 'các sáng kiến chăm sóc sức khỏe dự phòng' },
      { phrase: 'alleviate hospital overcrowding', meaningVi: 'giảm bớt tình trạng quá tải bệnh viện' },
      { phrase: 'early diagnostic screening', meaningVi: 'sàng lọc chẩn đoán sớm' },
      { phrase: 'long-term fiscal sustainability', meaningVi: 'tính bền vững tài khóa dài hạn' },
    ],
  },
  {
    id: 'idea-health-3',
    topic: 'Health',
    essayType: 'Discussion',
    prompt:
      'Some argue that workplaces should be legally required to support employee mental health, while others see stress management as a personal duty.',
    promptSummaryVi: 'Chăm sóc sức khỏe tinh thần là trách nhiệm của doanh nghiệp hay cá nhân?',
    sideATitle: 'Trách nhiệm của Doanh nghiệp (Organizational Stressors)',
    sideAArguments: [
      'Khối lượng công việc quá tải, giờ tăng ca và văn hóa liên lạc ngoài giờ là nguyên nhân trực tiếp gây kiệt sức (burnout).',
      'Nhân viên khỏe mạnh tinh thần giúp giảm tỷ lệ nghỉ việc và nâng cao năng suất chung.',
    ],
    sideBTitle: 'Trách nhiệm của Cá nhân (Lifestyle Choices)',
    sideBArguments: [
      'Ngủ đủ giấc, tập thể dục và thiết lập ranh giới cá nhân phụ thuộc vào kỷ luật sinh hoạt của mỗi người.',
    ],
    examples: [
      'Nhiều quốc gia châu Âu ban hành "quyền ngắt kết nối" (right to disconnect), cấm sếp gửi email yêu cầu xử lý việc ngoài giờ làm việc.',
    ],
    collocations: [
      { phrase: 'occupational burnout', meaningVi: 'tình trạng kiệt sức do công việc' },
      { phrase: 'work-life boundaries', meaningVi: 'ranh giới giữa công việc và đời sống' },
      { phrase: 'employee retention', meaningVi: 'khả năng giữ chân nhân sự' },
      { phrase: 'chronic workplace stress', meaningVi: 'căng thẳng nơi làm việc kéo dài' },
    ],
  },
  // WORK (3)
  {
    id: 'idea-work-1',
    topic: 'Work',
    essayType: 'Advantage/Disadvantage',
    prompt:
      'Many companies now adopt hybrid or fully remote working arrangements instead of daily office attendance.',
    promptSummaryVi: 'Lợi ích và bất lợi của làm việc từ xa / mô hình Hybrid.',
    sideATitle: 'Lợi ích (Productivity & Talent Pool)',
    sideAArguments: [
      'Tiết kiệm thời gian di chuyển giờ cao điểm, giảm áp lực giao thông và tăng sự tập trung cho các tác vụ độc lập.',
      'Doanh nghiệp có thể tuyển dụng nhân tài chất lượng cao ở bất kỳ địa phương nào.',
    ],
    sideBTitle: 'Bất lợi (Mentorship & Collaboration)',
    sideBArguments: [
      'Nhân viên mới khó hòa nhập văn hóa công ty và ít cơ hội học hỏi ngầm từ đồng nghiệp giàu kinh nghiệm.',
      'Giảm tính sáng tạo tự phát thường nảy sinh qua trao đổi trực tiếp.',
    ],
    examples: [
      'Mô hình hybrid 3 ngày tại văn phòng - 2 ngày từ xa đang trở thành chuẩn mực mới tại nhiều tập đoàn công nghệ và tài chính.',
    ],
    collocations: [
      { phrase: 'spontaneous collaboration', meaningVi: 'sự cộng tác sáng tạo tự phát' },
      { phrase: 'commuting fatigue', meaningVi: 'sự mệt mỏi do di chuyển đi làm hằng ngày' },
      { phrase: 'hybrid working arrangement', meaningVi: 'mô hình làm việc kết hợp trực tiếp và từ xa' },
      { phrase: 'institutional cohesion', meaningVi: 'sự gắn kết trong nội bộ tổ chức' },
    ],
  },
  {
    id: 'idea-work-2',
    topic: 'Work',
    essayType: 'Opinion',
    prompt:
      'Job satisfaction is more important than a high salary when choosing a long-term career.',
    promptSummaryVi: 'Sự hài lòng trong công việc có quan trọng hơn mức lương cao?',
    sideATitle: 'Ủng hộ sự hài lòng nghề nghiệp (Intrinsic Motivation)',
    sideAArguments: [
      'Công việc phù hợp đam mê và môi trường tôn trọng giúp duy trì động lực bền bỉ và hạn chế kiệt sức.',
      'Lương cao nhưng công việc nhàm chán, độc hại nhanh chóng gây suy giảm hạnh phúc cá nhân.',
    ],
    sideBTitle: 'Vai trò nền tảng của thu nhập (Financial Security)',
    sideBArguments: [
      'Thu nhập tốt đảm bảo nhà ở, chăm sóc sức khỏe gia đình và khả năng tích lũy trước rủi ro.',
      'Khi áp lực tài chính chưa được giải quyết, sự hài lòng khó có thể tồn tại lâu dài.',
    ],
    examples: [
      'Nghiên cứu kinh tế hành vi chỉ ra thu nhập tăng giúp cải thiện hạnh phúc mạnh nhất cho tới ngưỡng đủ sống an toàn, sau đó yếu tố ý nghĩa công việc chiếm ưu thế.',
    ],
    collocations: [
      { phrase: 'intrinsic motivation', meaningVi: 'động lực nội tại từ bên trong' },
      { phrase: 'financial security', meaningVi: 'sự an toàn về tài chính' },
      { phrase: 'career longevity', meaningVi: 'sự gắn bó lâu dài với nghề nghiệp' },
      { phrase: 'remuneration package', meaningVi: 'chế độ đãi ngộ và lương thưởng' },
    ],
  },
  {
    id: 'idea-work-3',
    topic: 'Work',
    essayType: 'Two-part Question',
    prompt:
      'Young adults are changing jobs more frequently than previous generations. Why is this happening, and what are the effects?',
    promptSummaryVi: 'Vì sao người trẻ nhảy việc thường xuyên hơn và tác động của xu hướng này?',
    sideATitle: 'Nguyên nhân (Skill Growth & Gig Economy)',
    sideAArguments: [
      'Thị trường lao động biến động nhanh khiến người trẻ chủ động tìm môi trường học kỹ năng mới và tăng thu nhập nhanh hơn mức tăng lương nội bộ.',
      'Ít mô hình việc làm trọn đời và sự phổ biến của làm việc tự do (freelance/gig economy).',
    ],
    sideBTitle: 'Hệ quả (Adaptability vs Instability)',
    sideBArguments: [
      'Tích cực: Lao động có trải nghiệm đa ngành, linh hoạt thích ứng công nghệ.',
      'Tiêu cực: Doanh nghiệp tốn chi phí tuyển dụng lại, còn cá nhân có thể thiếu chuyên môn sâu nếu chuyển việc quá vội.',
    ],
    examples: [
      'Các cuộc khảo sát nhân sự gần đây cho thấy người lao động trẻ trung bình đổi việc sau 2-3 năm để tìm cơ hội thăng tiến rõ rệt hơn.',
    ],
    collocations: [
      { phrase: 'job-hopping culture', meaningVi: 'văn hóa chuyển việc thường xuyên' },
      { phrase: 'recruitment turnover costs', meaningVi: 'chi phí phát sinh do nhân sự nghỉ việc và tuyển mới' },
      { phrase: 'cross-functional adaptability', meaningVi: 'khả năng thích ứng đa lĩnh vực' },
      { phrase: 'stagnant wage progression', meaningVi: 'mức tăng lương chậm chạp/dậm chân tại chỗ' },
    ],
  },
  // SOCIETY (3)
  {
    id: 'idea-soc-1',
    topic: 'Society',
    essayType: 'Problem/Solution',
    prompt:
      'Rapid urbanization has led to overcrowded cities and unaffordable housing. How can this issue be tackled?',
    promptSummaryVi: 'Đô thị hóa quá nhanh gây quá tải và giá nhà leo thang: Hệ lụy & Giải pháp.',
    sideATitle: 'Vấn đề (Infrastructure Strain & Cost of Living)',
    sideAArguments: [
      'Cơ hội việc làm tập trung quá mức ở siêu đô thị đẩy giá thuê nhà vượt khả năng chi trả của người trẻ.',
      'Hệ thống giao thông, trường học và lưới điện quá tải, gia tăng ô nhiễm không khí.',
    ],
    sideBTitle: 'Giải pháp (Satellite Cities & Social Housing)',
    sideBArguments: [
      'Phát triển đô thị vệ tinh kết nối bằng tàu cao tốc/metro và ưu đãi thuế cho doanh nghiệp mở văn phòng ở tỉnh lẻ.',
      'Xây dựng nhà ở xã hội giá ổn định và đánh thuế cao nhà đầu cơ bỏ trống.',
    ],
    examples: [
      'Chương trình nhà ở công cộng (HDB) tại Singapore giúp đại đa số hộ gia đình sở hữu chỗ ở ổn định bất chấp quỹ đất hạn hẹp.',
    ],
    collocations: [
      { phrase: 'unaffordable housing', meaningVi: 'nhà ở vượt quá khả năng chi trả' },
      { phrase: 'satellite urban hubs', meaningVi: 'các đô thị vệ tinh' },
      { phrase: 'overburdened infrastructure', meaningVi: 'cơ sở hạ tầng quá tải' },
      { phrase: 'decentralize economic activity', meaningVi: 'phi tập trung hóa hoạt động kinh tế ra khỏi lõi đô thị' },
    ],
  },
  {
    id: 'idea-soc-2',
    topic: 'Society',
    essayType: 'Advantage/Disadvantage',
    prompt:
      'In many nations, average life expectancy is rising while birth rates are declining, resulting in an ageing population.',
    promptSummaryVi: 'Lợi ích và thách thức của già hóa dân số (Ageing Population).',
    sideATitle: 'Thách thức nổi bật (Pension Burden & Labour Shortage)',
    sideAArguments: [
      'Tỷ lệ người nghỉ hưu tăng cao gây áp lực khổng lồ lên quỹ hưu trí và hệ thống chăm sóc lão khoa.',
      'Thiếu hụt lao động trẻ làm giảm sức bật đổi mới kinh tế.',
    ],
    sideBTitle: 'Khía cạnh tích cực (Experienced Mentorship & Silver Economy)',
    sideBArguments: [
      'Người lớn tuổi khỏe mạnh tiếp tục đóng góp kinh nghiệm cố vấn, trông nom gia đình hoặc tham gia công việc bán thời gian.',
    ],
    examples: [
      'Nhật Bản nâng dần tuổi nghỉ hưu khuyến khích và ứng dụng robot hỗ trợ điều dưỡng để bù đắp thiếu hụt nhân lực chăm sóc người cao tuổi.',
    ],
    collocations: [
      { phrase: 'demographic shift', meaningVi: 'sự chuyển dịch cơ cấu dân số' },
      { phrase: 'pension system strain', meaningVi: 'áp lực lên hệ thống lương hưu' },
      { phrase: 'shrinking workforce', meaningVi: 'lực lượng lao động thu hẹp' },
      { phrase: 'geriatric healthcare', meaningVi: 'chăm sóc y tế cho người cao tuổi' },
    ],
  },
  {
    id: 'idea-soc-3',
    topic: 'Society',
    essayType: 'Opinion',
    prompt:
      'The widening income gap between the richest and poorest citizens threatens long-term social stability.',
    promptSummaryVi: 'Khoảng cách giàu nghèo ngày càng rộng đe dọa sự ổn định xã hội?',
    sideATitle: 'Đồng ý (Unequal Opportunity & Social Unrest)',
    sideAArguments: [
      'Bất bình đẳng cực đoan tập trung quyền tiếp cận giáo dục tốt và y tế chất lượng vào nhóm giàu, khiến người nghèo mắc kẹt qua nhiều thế hệ.',
      'Làm xói mòn niềm tin vào thể chế công bằng và tăng nguy cơ bất ổn xã hội.',
    ],
    sideBTitle: 'Lưu ý sắc thái (Incentive vs Absolute Equality)',
    sideBArguments: [
      'Chênh lệch thu nhập hợp lý phản ánh nỗ lực, kỹ năng và chấp nhận rủi ro kinh doanh, thúc đẩy sáng tạo.',
      'Mục tiêu nên là đảm bảo mạng lưới an sinh cơ bản và bình đẳng cơ hội thay vì cào bằng kết quả.',
    ],
    examples: [
      'Đầu tư trường công lập chất lượng cao và thuế thu nhập lũy tiến giúp thu hẹp chênh lệch cơ hội giữa các tầng lớp.',
    ],
    collocations: [
      { phrase: 'socioeconomic disparity', meaningVi: 'sự chênh lệch kinh tế - xã hội' },
      { phrase: 'intergenerational poverty', meaningVi: 'cái nghèo truyền từ thế hệ này sang thế hệ khác' },
      { phrase: 'social safety net', meaningVi: 'mạng lưới an sinh xã hội' },
      { phrase: 'erode institutional trust', meaningVi: 'làm xói mòn niềm tin vào thể chế' },
    ],
  },
  // GOVERNMENT (3)
  {
    id: 'idea-gov-1',
    topic: 'Government',
    essayType: 'Opinion',
    prompt:
      'Public money should be spent on improving railways and public transport rather than building wider roads for private cars.',
    promptSummaryVi: 'Ngân sách công nên ưu tiên giao thông công cộng thay vì mở rộng đường cho ô tô cá nhân?',
    sideATitle: 'Ưu tiên Giao thông công cộng (Induced Demand & Sustainability)',
    sideAArguments: [
      'Mở rộng đường chỉ tạo ra "cầu phát sinh" (induced demand): nhiều người mua ô tô hơn và ùn tắc nhanh chóng quay trở lại.',
      'Đầu tư tàu điện, xe buýt chuyên dụng chở được lượng hành khách gấp nhiều lần trên cùng diện tích đất và giảm khí thải.',
    ],
    sideBTitle: 'Vai trò nhất định của hạ tầng đường bộ (Rural & Freight)',
    sideBArguments: [
      'Khu vực nông thôn thưa dân và vận tải hàng hóa liên tỉnh vẫn phụ thuộc vào hệ thống đường cao tốc bảo trì tốt.',
    ],
    examples: [
      'Các thành phố như Tokyo hay London vận hành mạng lưới tàu điện dày đặc giúp hàng triệu người di chuyển đúng giờ mà không cần phụ thuộc ô tô cá nhân.',
    ],
    collocations: [
      { phrase: 'induced traffic demand', meaningVi: 'hiện tượng mở đường kích thích thêm xe cá nhân' },
      { phrase: 'integrated transit network', meaningVi: 'mạng lưới giao thông công cộng tích hợp' },
      { phrase: 'urban gridlock', meaningVi: 'tình trạng kẹt xe tê liệt đô thị' },
      { phrase: 'reallocate public subsidies', meaningVi: 'tái phân bổ ngân sách trợ cấp công' },
    ],
  },
  {
    id: 'idea-gov-2',
    topic: 'Government',
    essayType: 'Discussion',
    prompt:
      'Some believe government funding for the arts is unnecessary and should be diverted to healthcare and education.',
    promptSummaryVi: 'Nhà nước có nên tài trợ cho nghệ thuật hay dồn hết cho y tế và giáo dục?',
    sideATitle: 'Ưu tiên Y tế & Giáo dục (Essential Services)',
    sideAArguments: [
      'Với ngân sách hữu hạn, thiết bị bệnh viện, lương giáo viên và hạ tầng cơ bản phục vụ trực tiếp nhu cầu thiết yếu của mọi công dân.',
    ],
    sideBTitle: 'Duy trì tài trợ Nghệ thuật (Cultural Capital & Tourism)',
    sideBArguments: [
      'Nếu không có trợ cấp công, chỉ các loại hình giải trí thương mại tồn tại, khiến sân khấu truyền thống, bảo tàng và âm nhạc hàn lâm mai một.',
      'Nghệ thuật thúc đẩy công nghiệp sáng tạo, du lịch văn hóa và mang lại nguồn thu thuế gián tiếp.',
    ],
    examples: [
      'Chính sách mở cửa miễn phí nhiều bảo tàng quốc gia tại London giúp mọi tầng lớp tiếp cận nghệ thuật đồng thời thu hút hàng triệu khách du lịch.',
    ],
    collocations: [
      { phrase: 'cultural enrichment', meaningVi: 'làm phong phú đời sống văn hóa' },
      { phrase: 'commercial viability', meaningVi: 'tính khả thi thương mại/tự nuôi sống' },
      { phrase: 'finite fiscal resources', meaningVi: 'nguồn lực ngân sách hữu hạn' },
      { phrase: 'creative industries', meaningVi: 'các ngành công nghiệp sáng tạo' },
    ],
  },
  {
    id: 'idea-gov-3',
    topic: 'Government',
    essayType: 'Opinion',
    prompt:
      'Strict laws and heavy fines are the most effective way to improve road safety and reduce traffic accidents.',
    promptSummaryVi: 'Luật nghiêm và phạt nặng có phải cách hiệu quả nhất để giảm tai nạn giao thông?',
    sideATitle: 'Vai trò răn đe của Luật & Phạt nặng (Deterrence)',
    sideAArguments: [
      'Tước bằng lái, phạt tiền nặng và camera phạt nguội đánh trực tiếp vào lỗi cố ý như chạy quá tốc độ và lái xe sau khi uống rượu bia.',
    ],
    sideBTitle: 'Cần kết hợp Hạ tầng & Giáo dục (Holistic Safety)',
    sideBArguments: [
      'Án phạt không khắc phục được tai nạn do điểm mù thiết kế đường, thiếu chiếu sáng hoặc xe xuống cấp.',
      'Đào tạo sát hạch lái xe thực chất và vạch phân làn rõ ràng giúp phòng ngừa tai nạn mang tính hệ thống.',
    ],
    examples: [
      'Chiến lược Vision Zero tại Thụy Điển kết hợp xử phạt nồng độ cồn nghiêm ngặt với thiết kế vòng xuyến và dải phân cách giảm tốc đã cắt giảm mạnh tử vong giao thông.',
    ],
    collocations: [
      { phrase: 'stringent enforcement', meaningVi: 'sự thực thi pháp luật nghiêm minh' },
      { phrase: 'act as a potent deterrent', meaningVi: 'đóng vai trò như biện pháp răn đe mạnh mẽ' },
      { phrase: 'systemic infrastructure flaws', meaningVi: 'lỗi thiết kế hạ tầng mang tính hệ thống' },
      { phrase: 'reckless driving habits', meaningVi: 'thói quen lái xe ẩu' },
    ],
  },
  // CULTURE (3)
  {
    id: 'idea-cul-1',
    topic: 'Culture',
    essayType: 'Opinion',
    prompt:
      'Globalization is making societies around the world look identical, causing local cultures and languages to disappear.',
    promptSummaryVi: 'Toàn cầu hóa làm đồng hóa bản sắc và khiến văn hóa, ngôn ngữ địa phương biến mất?',
    sideATitle: 'Nguy cơ đồng hóa văn hóa (Cultural Homogenization)',
    sideAArguments: [
      'Chuỗi bán lẻ đa quốc gia, phim ảnh và thương hiệu thời trang toàn cầu chi phối thị hiếu giới trẻ, làm lu mờ lễ hội và thủ công truyền thống.',
      'Ngôn ngữ phổ biến chiếm ưu thế trong thương mại và Internet khiến nhiều tiếng địa phương mất người sử dụng trẻ.',
    ],
    sideBTitle: 'Khả năng thích ứng & Bảo tồn (Cultural Hybridization)',
    sideBArguments: [
      'Công nghệ toàn cầu hóa cũng giúp số hóa tài liệu ngôn ngữ bản địa và quảng bá ẩm thực, di sản địa phương ra thế giới.',
      'Nhiều cộng đồng chủ động song ngữ và làm mới truyền thống thay vì bị xóa sổ hoàn toàn.',
    ],
    examples: [
      'Các nền tảng số và dự án bảo tồn di sản giúp ẩm thực, âm nhạc và thủ công mỹ nghệ bản địa tiếp cận thị trường xuất khẩu toàn cầu.',
    ],
    collocations: [
      { phrase: 'cultural homogenization', meaningVi: 'sự đồng hóa văn hóa' },
      { phrase: 'preserve indigenous heritage', meaningVi: 'bảo tồn di sản bản địa' },
      { phrase: 'erosion of linguistic diversity', meaningVi: 'sự xói mòn đa dạng ngôn ngữ' },
      { phrase: 'cross-cultural exchange', meaningVi: 'sự giao lưu văn hóa xuyên biên giới' },
    ],
  },
  {
    id: 'idea-cul-2',
    topic: 'Culture',
    essayType: 'Advantage/Disadvantage',
    prompt:
      'International tourism has become one of the fastest-growing industries worldwide. Does it bring more benefits or drawbacks to local communities?',
    promptSummaryVi: 'Du lịch quốc tế mang lại lợi ích hay tác hại nhiều hơn cho cộng đồng địa phương?',
    sideATitle: 'Lợi ích kinh tế & bảo tồn (Economic Stimulus)',
    sideAArguments: [
      'Tạo việc làm dịch vụ, nguồn thu ngoại tệ và động lực tài chính để trùng tu di tích lịch sử.',
      'Thúc đẩy thấu hiểu đa văn hóa và phá bỏ định kiến giữa các quốc gia.',
    ],
    sideBTitle: 'Bất cập quá tải du lịch (Overtourism)',
    sideBArguments: [
      'Tăng giá sinh hoạt đẩy cư dân bản địa khỏi khu phố cổ, gây quá tải rác thải và thương mại hóa nghi lễ truyền thống.',
    ],
    examples: [
      'Các thành phố di sản như Venice hay Amsterdam phải áp dụng phí vào cửa theo ngày và giới hạn tàu du lịch để chống quá tải.',
    ],
    collocations: [
      { phrase: 'overtourism pressures', meaningVi: 'áp lực do lượng khách du lịch quá tải' },
      { phrase: 'commercialization of traditions', meaningVi: 'sự thương mại hóa các phong tục truyền thống' },
      { phrase: 'foreign exchange revenue', meaningVi: 'nguồn thu ngoại tệ' },
      { phrase: 'sustainable visitor quotas', meaningVi: 'hạn mức khách tham quan bền vững' },
    ],
  },
  {
    id: 'idea-cul-3',
    topic: 'Culture',
    essayType: 'Discussion',
    prompt:
      'Some people believe historic buildings should be preserved at all costs, whereas others argue they should be demolished to build modern infrastructure.',
    promptSummaryVi: 'Nên giữ nguyên các công trình lịch sử hay phá bỏ để xây hạ tầng hiện đại?',
    sideATitle: 'Bảo tồn di sản kiến trúc (Historical Identity)',
    sideAArguments: [
      'Kiến trúc cổ là chứng nhân lịch sử sống động tạo nên bản sắc đô thị độc đáo và thu hút du lịch văn hóa.',
      'Một khi bị phá bỏ, giá trị nguyên bản của di tích không thể tái tạo.',
    ],
    sideBTitle: 'Thay thế bằng công trình hiện đại (Urban Functionality)',
    sideBArguments: [
      'Công trình cũ xuống cấp tốn chi phí bảo trì khổng lồ, kém hiệu quả năng lượng và không đáp ứng mật độ dân số đô thị hiện tại.',
      'Giải pháp cân bằng: bảo tồn mặt tiền/di tích xếp hạng cao và tái sử dụng thích ứng (adaptive reuse) bên trong.',
    ],
    examples: [
      'Bảo tàng Tate Modern tại London là hình mẫu cải tạo nhà máy điện cũ thành không gian văn hóa hiện đại thay vì đập bỏ hoàn toàn.',
    ],
    collocations: [
      { phrase: 'architectural heritage', meaningVi: 'di sản kiến trúc' },
      { phrase: 'adaptive reuse', meaningVi: 'tái sử dụng thích ứng cho công năng mới' },
      { phrase: 'prohibitive maintenance costs', meaningVi: 'chi phí bảo trì đắt đỏ' },
      { phrase: 'irreplaceable historical landmarks', meaningVi: 'những công trình lịch sử không thể thay thế' },
    ],
  },
];
