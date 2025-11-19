// --- 1. Import สิ่งที่จำเป็นจาก Firebase SDK ---
// (เราจะใช้ SDK v12.5.0 ตามไฟล์ firebase-controller.js ของคุณ)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getFirestore, writeBatch, doc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBF9-h8iLcvwJZ4_d_YC7mnIyTAY5fY_6I",
  authDomain: "logincartoonclub.firebaseapp.com",
  projectId: "logincartoonclub",
  storageBucket: "logincartoonclub.firebasestorage.app",
  messagingSenderId: "916222025571",
  appId: "1:916222025571:web:d5e2dc68f36489ed93bd56",
  measurementId: "G-NL2226PG1V"
};

// --- 3. Initialize Firebase สำหรับสคริปต์นี้โดยเฉพาะ ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 4. นี่คือข้อมูลการ์ตูน 30 เรื่องแรก (จาก 3 ลิสต์ที่เราคุยกัน) ---
// (ผมใส่ ID, placeholder URL, และ 'type' ให้ตาม Schema ที่เราออกแบบไว้)
export const seedData = [
  
  // === 10 ภาพยนตร์ (Movies) ===
  {
    id: 'movie-spirited-away',
    title: 'Spirited Away',
    description: 'เด็กสาว 10 ขวบหลงเข้าไปในโลกแห่งภูตผีและเทพเจ้า เธอต้องทำงานในโรงอาบน้ำของแม่มดเพื่อหาทางช่วยพ่อแม่ที่ถูกสาปให้เป็นหมู',
    type: 'movie',
    thumbnailURL: 'https://f.ptcdn.info/797/041/000/o5mkk67wd0ZVOV343aJ-o.jpg',
    requiresSubscription: true,
    tags: ['anime', 'fantasy', 'adventure'],
    isRecommended: true ,
  isFeaturedHero: true,
  heroImageURL: 'ByXuk9QqQkk'
  },
  {
    id: 'movie-your-name',
    title: 'Your Name.',
    description: 'Your Name. (อนิเมะญี่ปุ่น): เด็กหนุ่มในโตเกียวและเด็กสาวในชนบทเริ่มสลับร่างกันอย่างลึกลับ แต่เมื่อพวกเขาพยายามค้นหาความจริง ก็พบว่ามีบางอย่างที่ยิ่งใหญ่กว่านั้นเชื่อมโยงพวกเขาทั้งคู่ไว้',
    type: 'movie',
    thumbnailURL: 'https://f.ptcdn.info/951/054/000/p0a9hu9vixS1hldUiNX-o.jpg',
    requiresSubscription: true,
    tags: ['anime', 'romance', 'fantasy'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'NooIc3dMncc'
  },
  {
    id: 'movie-powerpuff-girls',
    title: 'The Powerpuff Girls Movie',
    description: 'The Powerpuff Girls Movie (Cartoon Network): เรื่องราวต้นกำเนิดของ บลอสซัม, บับเบิลส์ และ บัตเตอร์คัพ หลังจากการระเบิดพลังครั้งแรกที่ทำลายเมือง พวกเธอต้องพิสูจน์ตัวเองและกอบกู้เมืองจากแผนร้ายของโมโจ โจโจ้',
    type: 'movie',
  thumbnailURL: 'https://m.media-amazon.com/images/S/pv-target-images/893dc8d7922447917ec22541f4c805bc266197dda4b042bb48d9aab9566a7439.jpg',
    requiresSubscription: false, // (ตัวอย่าง: บางทีหนังเก่าเราอาจให้ดูฟรี)
    tags: ['cartoon', 'action', 'comedy'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'dvGvg4Hv66Q'
  },
  {
    id: 'movie-steven-universe',
    title: 'Steven Universe: The Movie',
    description: 'Steven Universe: The Movie (Cartoon Network): สองปีหลังความสงบสุข สตีเวนและคริสตัลเจมส์ต้องเผชิญหน้ากับศัตรูใหม่ \'สปิเนล\' ผู้มาพร้อมอาวุธล้างความทรงจำ สตีเวนต้องช่วยเพื่อนๆ ให้ "จำ" ได้อีกครั้ง ก่อนที่โลกจะถูกทำลาย',
    type: 'movie',
  thumbnailURL: 'https://cdn.iview.abc.net.au/thumbs/1200/zw/ZW4774A_68df9d5b759a8_3600.jpg',
    requiresSubscription: true,
    tags: ['cartoon', 'musical', 'sci-fi'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'fZsuug-3r_Q'
  },
  {
    id: 'movie-akira',
    title: 'Akira',
    description: 'Akira (อนิเมะญี่ปุ่น): ในโลกอนาคตดิสโทเปียแห่งนีโอ-โตเกียว คาเนดะ หัวหน้าแก๊งมอเตอร์ไซค์ ต้องแข่งกับเวลาเพื่อช่วยเพื่อนของเขา เท็ตสึโอะ ผู้ซึ่งได้รับพลังจิตอันตรายหลังเกิดอุบัติเหตุ',
    type: 'movie',
  thumbnailURL: 'https://s.isanook.com/mv/0/ud/7/36952/akira.jpg?ip/resize/w850/q80/jpg',
    requiresSubscription: true,
    tags: ['anime', 'sci-fi', 'cyberpunk'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'nA8KmHC2Z-g'
  },
  {
    id: 'movie-ed-edd-eddy',
    title: 'Ed, Edd n Eddy\'s Big Picture Show',
    description: 'Ed, Edd n Eddy\'s Big Picture Show (Cartoon Network): หลังจากการต้มตุ๋นครั้งใหญ่ล้มเหลวและทำให้เพื่อนๆ ในย่านแค้นจัด สามเอ็ดต้องออกเดินทางครั้งยิ่งใหญ่เพื่อตามหา "พี่ชาย" ของเอ็ดดี้เพื่อขอความช่วยเหลือ',
    type: 'movie',
  thumbnailURL: 'https://a.ltrbxd.com/resized/sm/upload/re/a7/v4/2x/zvYyXc4wfevrxDRhkdyANMqu9KD-1200-1200-675-675-crop-000000.jpg?v=360e18f3fc',
    requiresSubscription: false,
    tags: ['cartoon', 'comedy', 'road-trip'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'Qb_9aec2Cck'
  },
  {
    id: 'movie-mononoke',
    title: 'Princess Mononoke',
    description: 'Princess Mononoke (อนิเมะญี่ปุ่น): เจ้าชายอาชิทากะที่ต้องคำสาป ต้องเดินทางไปยังป่าศักดิ์สิทธิ์ และพบว่าตัวเองอยู่ท่ามกลางสงครามระหว่างเมืองอุตสาหกรรมกับเทพเจ้าสัตว์ป่าที่นำโดย ซาน เด็กสาวผู้ถูกหมาป่าเลี้ยงดู',
    type: 'movie',
  thumbnailURL: 'https://f.ptcdn.info/446/065/000/pw2ath1liFya845CnE-o.jpg',
    requiresSubscription: true,
    tags: ['anime', 'fantasy', 'action'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: '4OiMOHRDs14'
  },
  {
    id: 'movie-we-bare-bears',
    title: 'We Bare Bears: The Movie',
    description: 'We Bare Bears: The Movie (Cartoon Network): เมื่อวีรกรรมป่วนๆ ของสามหมีทำให้ชาวเมืองไม่พอใจ พวกเขาถูกเจ้าหน้าที่เทราต์ไล่ล่า กริซ แพนด้า และไอซ์แบร์ จึงต้องหนีและตัดสินใจออกเดินทางไปแคนาดา',
    type: 'movie',
  thumbnailURL: 'https://cdn.mos.cms.futurecdn.net/v2/t:62,l:0,cw:1200,ch:675,q:80,w:1200/Xz8treHz3rc3qZxC5A27KY.jpg',
    requiresSubscription: true,
    tags: ['cartoon', 'comedy', 'adventure'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: '0ZNsLy2IwcY'
  },
  {
    id: 'movie-a-silent-voice',
    title: 'A Silent Voice',
    description: 'A Silent Voice (อนิเมะญี่ปุ่น): โชยะ อิชิดะ เด็กหนุ่มผู้เคยกลั่นแกล้ง โชโกะ นิชิมิยะ เด็กสาวหูหนวกในวัยประถม หลายปีต่อมา เขาต้องจมอยู่กับความรู้สึกผิดและกลายเป็นคนโดดเดี่ยว เขาจึงออกตามหาเธออีกครั้งเพื่อขอไถ่โทษ',
    type: 'movie',
  thumbnailURL: 'https://takanodan.net/assets/images/posts/14-knk/cover.jpg',
    requiresSubscription: true,
    tags: ['anime', 'drama', 'slice-of-life'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'nfK6UgLra7g'
  },
  {
    id: 'movie-ben-10-race',
    title: 'Ben 10: Race Against Time',
    description: 'Ben 10: Race Against Time (Cartoon Network): เบ็น เท็นนีย์สัน กลับมาใช้ชีวิตปกติในโรงเรียน แต่ความสงบสุขก็จบลงเมื่อ "เอเลี่ยน" (Eon) ผู้เดินทางข้ามเวลาปรากฏตัว เพื่อชิงออมนิทริกซ์และปลุกกองทัพต่างดาวมาทำลายโลก',
    type: 'movie',
  thumbnailURL: 'https://m.media-amazon.com/images/M/MV5BZmJiZTdkNTItNjVkOC00NTViLWJhMjQtNWNmODUyY2E2ZTZiXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    requiresSubscription: false,
    tags: ['cartoon', 'action', 'sci-fi'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'psZxewRfIgw'
  },

  // === 10 ซีรีส์ (Series) ===
  {
    id: 'series-one-piece',
    title: 'One Piece',
    description: 'One Piece (อนิเมะญี่ปุ่น): การผจญภัยของ มังกี้ ดี. ลูฟี่ เด็กหนุ่มผู้กินผลไม้ปีศาจจนกลายเป็นมนุษย์ยาง เขาและกลุ่มโจรสลัดหมวกฟางออกเดินทางสู่แกรนด์ไลน์ เพื่อตามหาสมบัติในตำนาน "วันพีซ" และก้าวขึ้นเป็นราชาโจรสลัด',
    type: 'series',
  thumbnailURL: 'https://occ-0-8407-2218.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABURj5IDk5oCinFriJlxNjIrooPk24OeaNy-KHh3RAkpL5dpQ7MUzboD2AFpyMgWR-XElhv9Fsgd2W5ISE-Z3eXYMjU2D7vk0TW1J.jpg?r=588',
    requiresSubscription: true,
    tags: ['anime', 'action', 'adventure'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'S8_YwFLCh4U'
  },
  {
    id: 'series-adventure-time',
    title: 'Adventure Time',
    description: 'Adventure Time (Cartoon Network): ติดตามการผจญภัยสุดเพี้ยนของ ฟินน์ เด็กหนุ่มมนุษย์ และ เจค สุนัขวิเศษผู้เปลี่ยนรูปร่างได้ ในดินแดนมหัศจรรย์หลังโลกล่มสลายที่ชื่อว่า "ดินแดนอู"',
    type: 'series',
  thumbnailURL: 'https://media.wired.com/photos/5932661626780e6c04d2b642/master/pass/AdventureTime.jpg',
    requiresSubscription: true,
    tags: ['cartoon', 'fantasy', 'comedy'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'DRaLQ3kKz_k'
  },
  {
    id: 'series-attack-on-titan',
    title: 'Attack on Titan',
    description: 'Attack on Titan (อนิเมะญี่ปุ่น): ในโลกที่มนุษยชาติต้องอาศัยอยู่หลังกำแพงสูงเพื่อหนีไททันกินคน เอเลน เยเกอร์ สาบานว่าจะล้างบางพวกมันให้สิ้นซาก หลังได้เห็นแม่ของตนถูกไททันสังหาร',
    type: 'series',
  thumbnailURL: 'https://m.media-amazon.com/images/S/pv-target-images/c4a482851a80ece7b6c052de1a9109a11dfa7714e58a6b60184bc2b59ecd7e21._SX1080_FMjpg_.jpg',
    requiresSubscription: true,
    tags: ['anime', 'action', 'dark-fantasy'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'LV-nazLVmgo'
  },
  {
    id: 'series-gumball',
    title: 'The Amazing World of Gumball',
    description: 'The Amazing World of Gumball (Cartoon Network): ชีวิตสุดป่วนของ กัมบอล แมวสีฟ้าวัย 12 และ ดาร์วิน น้องชายปลาทองเดินได้ ในเมืองเอลมอร์ที่ทุกสิ่งมีชีวิต ตั้งแต่ขนมปังไปจนถึงไดโนเสาร์ทีเร็กซ์',
    type: 'series',
  thumbnailURL: 'https://m.media-amazon.com/images/S/pv-target-images/97b857923df97ac8fbe23939bd2baebc2327e424ed0cd27b6731528e0c21c185._SX1080_FMjpg_.jpg',
    requiresSubscription: true,
    tags: ['cartoon', 'comedy', 'surreal'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'KKoY9eIx6Qw'
  },
  {
    id: 'series-demon-slayer',
    title: 'Demon Slayer: Kimetsu no Yaiba',
    description: 'Demon Slayer: Kimetsu no Yaiba (อนิเมะญี่ปุ่น): ทันจิโร่ คามาโดะ ต้องกลายเป็นนักล่าอสูรหลังจากครอบครัวถูกฆ่า และ เนซึโกะ น้องสาวคนเดียวที่รอดชีวิตกลับกลายเป็นอสูร เขาจึงออกเดินทางเพื่อล้างแค้นและหาทางทำให้น้องสาวกลับเป็นมนุษย์',
    type: 'series',
  thumbnailURL: 'https://m.media-amazon.com/images/S/pv-target-images/97bbbb1dd00a72b5bf99be25a2c2159758a635be27d550598ca1540de246aa57._SX1080_FMjpg_.jpg',
    requiresSubscription: true,
    tags: ['anime', 'action', 'dark-fantasy'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'gkXS7_5GOgc'
  },
  {
    id: 'series-dexters-lab',
    title: 'Dexter\'s Laboratory',
    description: 'Dexter\'s Laboratory (Cartoon Network): เด็กซ์เตอร์ เด็กอัจฉริยะผู้ซ่อนห้องแล็บขนาดยักษ์ไว้หลังตู้หนังสือในห้องนอน ต้องคอยปกป้องสิ่งประดิษฐ์ของเขาจาก ดีดี้ พี่สาวจอมป่วนที่ชอบเข้ามาเต้นระบำและทำลายทุกอย่าง',
    type: 'series',
  thumbnailURL: 'https:/imgix.ranker.com/list_img_v2/19530/3299530/original/3299530',
    requiresSubscription: false,
    tags: ['cartoon', 'comedy', 'sci-fi'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'Ya3Q9OLk25g'
  },
  {
    id: 'series-fullmetal-brotherhood',
    title: 'Fullmetal Alchemist: Brotherhood',
    description: 'Fullmetal Alchemist: Brotherhood (อนิเมะญี่ปุ่น): สองพี่น้อง เอ็ดเวิร์ด และ อัลฟองส์ เอลริค พยายามใช้วิชาแปรธาตุต้องห้ามเพื่อชุบชีวิตแม่ แต่ล้มเหลว เอ็ดเวิร์ดเสียแขนและขา ส่วนอัลฟองส์เสียร่างกายทั้งหมด พวกเขาจึงออกเดินทางตามหาศิลานักปราชญ์เพื่อนำทุกสิ่งกลับคืนมา',
    type: 'series',
  thumbnailURL: 'https://m.media-amazon.com/images/S/pv-target-images/b743d74a9526c5f3fe7c9189c053166a453ae3000d13669e189193db60d9510a.jpg',
    requiresSubscription: true,
    tags: ['anime', 'action', 'steampunk'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: '-GoNo0DGroU'
  },
  {
    id: 'series-ben-10',
    title: 'Ben 10 (Original)',
    description: 'Ben 10 (Original) (Cartoon Network): วันหยุดฤดูร้อนของ เบ็น เท็นนีย์สัน วัย 10 ขวบ เปลี่ยนไปตลอดกาล เมื่อเขาพบ ออมนิทริกซ์ นาฬิกาเอเลี่ยนที่ทำให้เขาสามารถแปลงร่างเป็นฮีโร่ต่างดาวได้ถึง 10 แบบ',
    type: 'series',
  thumbnailURL: 'https://i.ytimg.com/vi/ebfV2J4lso4/maxresdefault.jpg',
    requiresSubscription: false,
    tags: ['cartoon', 'action', 'sci-fi'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'z0yzRwCFblA'
  },
  {
    id: 'series-naruto-shippuden',
    title: 'Naruto: Shippuden',
    description: 'Naruto: Shippuden (อนิเมะญี่ปุ่น): 2 ปีครึ่งหลังจากการฝึกฝน นารูโตะกลับมายังโคโนฮะอีกครั้งในฐานะนินจาหนุ่มที่แข็งแกร่งขึ้น เขาต้องเผชิญหน้ากับองค์กร "แสงอุษา" (Akatsuki) ที่พยายามรวบรวมสัตว์หางทั้งหมด',
    type: 'series',
  thumbnailURL: 'https://s.isanook.com/ga/0/ui/236/1184538/gal-1184538-20250108021347-b330d2f.jpeg',
    requiresSubscription: true,
    tags: ['anime', 'action', 'ninja'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'QczGoCmX-pI'
  },
  {
    id: 'series-powerpuff-girls',
    title: 'The Powerpuff Girls (Original)',
    description: 'The Powerpuff Girls (Original) (Cartoon Network): ณ เมืองทาวน์สวิลล์ สามสาวยอดนักสู้ บลอสซัม, บับเบิลส์ และ บัตเตอร์คัพ ผู้เกิดจาก "น้ำตาล เครื่องเทศ และของกุ๊กกิ๊ก" (ผสมเคมี X) คอยต่อสู้กับอาชญากรรมและสัตว์ประหลาดก่อนถึงเวลานอน',
    type: 'series',
  thumbnailURL: 'https://media.wired.com/photos/592715e2cfe0d93c474324eb/3:2/w_2560%2Cc_limit/PowerpuffGirls.jpg',
    requiresSubscription: false,
    tags: ['cartoon', 'action', 'comedy'],
    isRecommended: false,
  isFeaturedHero: true,
  heroImageURL: 'ATDTFjsXOdQ'
  },

  // === 10 การ์ตูนแนะนำ (Recommended) ===
  {
    id: 'series-jujutsu-kaisen',
    title: 'Jujutsu Kaisen',
    description: 'Jujutsu Kaisen (อนิเมะญี่ปุ่น): ยูจิ อิทาโดริ เด็กหนุ่มมัธยมปลายผู้กลืน "นิ้วต้องสาป" เพื่อช่วยเพื่อน และกลายเป็นร่างภาชนะของสุคุนะ คำสาปที่แข็งแกร่งที่สุด เขาจึงเข้าร่วมโรงเรียนไสยเวทเพื่อเรียนรู้การควบคุมพลังและต่อสู้กับคำสาป',
    type: 'series',
    thumbnailURL: 'https://external-preview.redd.it/jujutsu-kaisen-season-3-will-be-some-of-the-best-anime-ever-v0-p0WFRquUzQSEo8nboYUCLPqj5ZhyiL9F6Yuu122FtGQ.jpeg?width=640&crop=smart&auto=webp&s=8dcacd2d0bd7e5547755d85906b5374fc1a6abad',
    requiresSubscription: true,
    tags: ['anime', 'action', 'supernatural'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'RYI-WG_HFV8'
  },
  {
    id: 'series-over-the-garden-wall',
    title: 'Over the Garden Wall',
    description: 'Over the Garden Wall (Cartoon Network): สองพี่น้อง เวิร์ท และ เกร็ก ต้องเดินทางผ่านป่าลึกลับที่เรียกว่า "แดนนิรนาม" (The Unknown) เพื่อหาทางกลับบ้าน พวกเขาต้องพบกับเรื่องราวแปลกประหลาดและต้องหนีจากอสูรร้ายในเงามืด',
    type: 'series',
  thumbnailURL: 'https://m.media-amazon.com/images/S/pv-target-images/8a7f85982c1234e5556a71587c6d1ab043f348f2e958653452625bd0ca60f138._SX1080_FMjpg_.jpg',
    requiresSubscription: true,
    tags: ['cartoon', 'fantasy', 'adventure'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: '36mAsVSH_-s'
  },
  {
    id: 'series-frieren',
    title: 'Frieren: Beyond Journey\'s End',
    description: 'Frieren: Beyond Journey\'s End (อนิเมะญี่ปุ่น): หลังจากปราบจอมมาร ฟรีเรน เอลฟ์นักเวทผู้มีชีวิตยืนยาวนับพันปี ต้องเผชิญกับความรู้สึกสูญเสียเมื่อเพื่อนร่วมทีมที่เป็นมนุษย์จากไป เธอจึงออกเดินทางอีกครั้งเพื่อ "ทำความเข้าใจ" มนุษย์',
    type: 'series',
  thumbnailURL: 'https://www.dexerto.com/cdn-image/wp-content/uploads/2023/09/28/frieren-beyond-journeys-end.jpeg?width=1200&quality=60&format=auto',
    requiresSubscription: true,
    tags: ['anime', 'fantasy', 'drama'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'Iwr1aLEDpe4'
  },
  {
    id: 'series-samurai-jack',
    title: 'Samurai Jack',
    description: 'Samurai Jack (Cartoon Network): ซามูไรหนุ่มถูก อสูรชั่วร้าย อาคู ส่งมายังอนาคตดิสโทเปียที่อาคูครองโลก ในชื่อ "แจ็ค" เขาต้องต่อสู้กับเทคโนโลยีและสมุนของอาคู เพื่อหาทางกลับไปทำลายอดีต',
    type: 'series',
  thumbnailURL: 'https://cdn1.epicgames.com/db9feb0da696474e9923764dd75b9854/offer/EGS_SamuraiJackBattleThroughTime_SoleilLtd_S1-2560x1440-8942adb4828f708e146f10e614aee795.jpg',
    requiresSubscription: true,
    tags: ['cartoon', 'action', 'sci-fi'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'VSrv_n4tw7w'
  },
  {
    id: 'series-steins-gate',
    title: 'Steins;Gate',
    description: 'Steins;Gate (อนิเมะญี่ปุ่น): โอคาเบะ รินทาโร่ นักวิทยาศาสตร์สติเฟื่องผู้ก่อตั้งแล็บในอากิฮาบาระ ค้นพบว่าไมโครเวฟที่เขาดัดแปลงสามารถส่งข้อความกลับไปในอดีตได้ การค้นพบนี้ทำให้เขาต้องเผชิญกับองค์กรลับและผลกระทบอันเลวร้ายของการเปลี่ยนแปลงอดีต',
    type: 'series',
  thumbnailURL: 'https://f.ptcdn.info/856/057/000/p9jfqqa7qG8wHkuz5Cc-o.png',
    requiresSubscription: true,
    tags: ['anime', 'sci-fi', 'thriller'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'uMYhjVwp0Fk'
  },
  {
    id: 'series-teen-titans',
    title: 'Teen Titans (Original)',
    description: 'Teen Titans (Original) (การ์ตูนตะวันตก): ติดตามชีวิตของ 5 ฮีโร่วัยรุ่น: โรบิน, สตาร์ไฟร์, ไซบอร์ก, เรเวน และ บีสต์บอย พวกเขาอาศัยอยู่ด้วยกันในหอคอยไททันส์ ต่อสู้กับอาชญากรรมในเมืองจัมป์ซิตี้ และรับมือปัญหาวัยรุ่นไปพร้อมกัน',
    type: 'series',
  thumbnailURL: 'https://variety.com/wp-content/uploads/2016/03/teentitans.jpg?w=1000&h=667&crop=1',
    requiresSubscription: false,
    tags: ['cartoon', 'action', 'superhero'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'r9WhJyyTtqo'
  },
  {
    id: 'series-code-geass',
    title: 'Code Geass',
    description: 'Code Geass (อนิเมะญี่ปุ่น): ลูลูช เจ้าชายผู้ถูกเนรเทศ ได้รับพลัง "กีอัส" ที่สามารถสั่งการใครก็ได้ เขาสวมหน้ากากในนาม "ซีโร่" เพื่อก่อสงครามปฏิวัติจักรวรรดิบริทาเนียที่ปกครองญี่ปุ่นอยู่',
    type: 'series',
  thumbnailURL: 'https://www.slashfilm.comimg/gallery/9-best-episodes-of-code-geass-ranked/intro-1727721960.jpg',
    requiresSubscription: true,
    tags: ['anime', 'action', 'mecha', 'sci-fi'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'v-AGjx0N24U'
  },
  {
    id: 'series-justice-league-unlimited',
    title: 'Justice League Unlimited',
    description: 'Justice League Unlimited (การ์ตูนตะวันตก): สานต่อภารกิจจาก Justice League เหล่าซูเปอร์ฮีโร่ผู้ก่อตั้งได้ขยายทีม รวบรวมฮีโร่นับสิบจากทั่วทุกมุมโลกเพื่อรับมือกับภัยคุกคามระดับจักรวาลและแผนการลับของรัฐบาล',
    type: 'series',
  thumbnailURL: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4tFtTPn3omCgpckx9V7Nj7zWj_TwfayHWCw&s',
    requiresSubscription: true,
    tags: ['cartoon', 'action', 'superhero'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'WwVgB0MRCVg'
  },
  {
    id: 'series-one-punch-man',
    title: 'One-Punch Man',
    description: 'One-Punch Man (อนิเมะญี่ปุ่น): ไซตามะ ฮีโร่ผู้ฝึกฝนร่างกายจนแข็งแกร่งที่สุดในปฐพี ถึงขั้นล้มศัตรูได้ด้วย "หมัดเดียว" แต่พลังที่มากเกินไปกลับทำให้เขาเบื่อหน่ายกับการต่อสู้',
    type: 'series',
  thumbnailURL: 'https://occ-0-8407-2218.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABai4RMArlXRBLhl-S8z_7Wusexcsd5jozqYHIgFK73hR3Va4S3NX6WRRDFc1ACAZ5uTNZ3wbhpdfzt0jkH2ZM6V6wyRY2_LT_p0c.jpg?r=619',
    requiresSubscription: true,
    tags: ['anime', 'action', 'comedy'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'atxYe-nOa9w'
  },
  {
    id: 'series-fosters-home',
    title: 'Foster\'s Home for Imaginary Friends',
    description: 'Foster\'s Home for Imaginary Friends (Cartoon Network): ในโลกที่ "เพื่อนในจินตนาการ" มีตัวตนจริง เมื่อเด็กๆ โตขึ้น เพื่อนเหล่านี้จะถูกทอดทิ้ง นี่คือเรื่องราวของ แมค เด็กชายวัย 8 ขวบ และ บลู เพื่อนในจินตนาการจอมกวนของเขา ที่ต้องมาอยู่ในบ้านอุปถัมภ์แห่งนี้',
    type: 'series',
  thumbnailURL: 'https://static0.colliderimages.com/wordpress/wp-content/uploads/2022/07/fosters-home-for-imaginary-friends.jpg?w=1200&h=675&fit=crop',
    requiresSubscription: false,
    tags: ['cartoon', 'comedy', 'fantasy'],
    isRecommended: true,
  isFeaturedHero: true,
  heroImageURL: 'djNHGRkg2R4'
  }
];


/**
 * 🚀 ฟังก์ชันหลักสำหรับ Seed ข้อมูล
 * (ใช้ WriteBatch เพื่อส่งข้อมูล 30 รายการในครั้งเดียว)
 */
export async function seedContentCollection() {
  console.log('กำลังเริ่มต้น Seed ข้อมูล... (กรุณารอสักครู่)');
  
  // 1. สร้าง Batch
  const batch = writeBatch(db);

  // 2. วนลูปเพิ่มข้อมูลลงใน Batch
  seedData.forEach(item => {
    // สร้าง Reference ไปยังเอกสาร โดยใช้ 'id' ที่เรากำหนดเอง
    const docRef = doc(db, "content", item.id);
    
    // แยก 'id' ออกจาก object ที่จะบันทึก
    const { id, ...dataToSave } = item;
    
    // เพิ่ม "ข้อมูลเริ่มต้น" (สำหรับ Admin Dashboard)
    // ให้ค่าเริ่มต้นที่สมจริงมากขึ้น: ผู้ชมรวมและผู้ติดตาม
    dataToSave.totalWatchMinutes = Math.floor(Math.random() * 500000); // 0..500k minutes
    dataToSave.followerCount = Math.floor(Math.random() * 200000); // 0..200k followers
    dataToSave.episodeCount = (item.type === 'series') ? (item.episodeCount || 25) : 1; // respect provided value if present

    // เพิ่มข้อมูล weekly subcollection สำหรับ top10 weekly
    dataToSave._seed_weekly = true; // marker for optional processing by seed-all
    
    batch.set(docRef, dataToSave);
  });

  // 3. ส่ง Batch ทั้งหมดขึ้น Firebase
  try {
    await batch.commit();
    console.log(`✅ Seed ข้อมูลสำเร็จ! เพิ่มการ์ตูน ${seedData.length} เรื่องลงใน Collection 'content' แล้ว`);
    return `Seed ข้อมูลสำเร็จ! เพิ่มการ์ตูน ${seedData.length} เรื่องแล้ว`;
  } catch (e) {
    console.error("🔥 เกิดข้อผิดพลาด أثناءการ Seed: ", e);
    return `เกิดข้อผิดพลาด: ${e.message}`;
  }
}