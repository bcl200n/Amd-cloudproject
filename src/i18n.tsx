import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export type Language = 'zh' | 'en';

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

type TranslationKey =
  | 'language_label'
  | 'title'
  | 'subtitle'
  | 'help'
  | 'help_title'
  | 'help_intro'
  | 'help_spectating_title'
  | 'help_spectating_body'
  | 'help_interactivity_title'
  | 'help_interactivity_body'
  | 'help_controls'
  | 'help_click_nav'
  | 'help_talk_body'
  | 'help_limit'
  | 'loading_town'
  | 'loading_renderer'
  | 'star'
  | 'interact'
  | 'leave'
  | 'freeze'
  | 'unfreeze'
  | 'freeze_title'
  | 'music'
  | 'mute'
  | 'music_title'
  | 'select_agent_hint'
  | 'start_conversation'
  | 'waiting_accept'
  | 'walking_over'
  | 'leave_conversation'
  | 'accept'
  | 'reject'
  | 'this_is_you'
  | 'conversing_with_you'
  | 'previous_conversation'
  | 'joined_conversation'
  | 'left_conversation'
  | 'typing'
  | 'type_here'
  | 'events_panel_title'
  | 'events_panel_subtitle'
  | 'event_earthquake'
  | 'event_city_update'
  | 'status_active'
  | 'status_inactive'
  | 'started_at'
  | 'ends_at'
  | 'next_at'
  | 'interactions_in_window'
  | 'top_event_types'
  | 'top_actors'
  | 'top_dyads'
  | 'no_data';

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    language_label: '中文',
    title: 'AI Town',
    subtitle: 'A virtual town where AI characters live, chat and socialize.',
    help: 'Help',
    help_title: 'Help',
    help_intro:
      'Welcome to AI town. AI town supports both anonymous spectators and logged in interactivity.',
    help_spectating_title: 'Spectating',
    help_spectating_body:
      'Click and drag to move around the town, and scroll in and out to zoom. You can click on an individual character to view its chat history.',
    help_interactivity_title: 'Interactivity',
    help_interactivity_body:
      'If you log in, you can join the simulation and directly talk to different agents! After logging in, click the "Interact" button, and your character will appear somewhere on the map with a highlighted circle underneath you.',
    help_controls: 'Controls:',
    help_click_nav: 'Click to navigate around.',
    help_talk_body:
      'To talk to an agent, click on them and then click "Start conversation," which will ask them to start walking towards you. Once they are nearby, the conversation will start, and you can speak to each other. You can leave at any time by closing the conversation pane or moving away. They may propose a conversation to you - you will see a button to accept in the messages panel.',
    help_limit: 'AI town only supports {count} humans at a time. If you are idle for five minutes, you will be automatically removed from the simulation.',
    loading_town: 'Loading town...',
    loading_renderer: 'Loading renderer...',
    star: 'Star',
    interact: 'Interact',
    leave: 'Leave',
    freeze: 'Freeze',
    unfreeze: 'Unfreeze',
    freeze_title:
      'When freezing a world, the agents will take some time to stop what they are doing before they become frozen.',
    music: 'Music',
    mute: 'Mute',
    music_title: 'Play AI generated music (press m to play/mute)',
    select_agent_hint: 'Click on an agent on the map to see chat history.',
    start_conversation: 'Start conversation',
    waiting_accept: 'Waiting for accept...',
    walking_over: 'Walking over...',
    leave_conversation: 'Leave conversation',
    accept: 'Accept',
    reject: 'Reject',
    this_is_you: 'This is you!',
    conversing_with_you: 'Conversing with you!',
    previous_conversation: 'Previous conversation',
    joined_conversation: 'joined the conversation.',
    left_conversation: 'left the conversation.',
    typing: 'typing...',
    type_here: 'Type here',
    events_panel_title: 'World Events',
    events_panel_subtitle: 'Monitor short earthquakes and long city updates with interaction stats.',
    event_earthquake: 'Earthquake',
    event_city_update: 'City Update',
    status_active: 'Active',
    status_inactive: 'Inactive',
    started_at: 'Started',
    ends_at: 'Ends',
    next_at: 'Next',
    interactions_in_window: 'Interactions in current/latest window',
    top_event_types: 'Top event types',
    top_actors: 'Top actors',
    top_dyads: 'Top dyads',
    no_data: 'No data yet',
  },
  zh: {
    language_label: 'EN',
    title: 'AI 小镇',
    subtitle: '一个由 AI 角色生活、聊天与社交的虚拟小镇。',
    help: '帮助',
    help_title: '帮助',
    help_intro: '欢迎来到 AI 小镇。AI 小镇支持匿名旁观和登录后互动两种模式。',
    help_spectating_title: '旁观模式',
    help_spectating_body:
      '按住并拖动画面可移动视角，滚轮可缩放。你也可以点击任意角色查看其聊天历史。',
    help_interactivity_title: '互动模式',
    help_interactivity_body:
      '登录后你可以加入模拟并直接与不同 agents 对话。点击“互动”按钮后，你的角色会出现在地图上，并带有高亮圆圈。',
    help_controls: '操作说明：',
    help_click_nav: '点击地图可进行移动。',
    help_talk_body:
      '想和某个 agent 对话时，先点击对方，再点击“开始对话”。对方会向你走来，靠近后对话开始。你可以随时关闭对话面板或走开来离开。对方也可能主动邀请你，你会在消息面板里看到“接受”按钮。',
    help_limit: 'AI 小镇最多同时支持 {count} 位人类玩家。若你空闲 5 分钟，将自动从模拟中移除。',
    loading_town: '正在加载小镇...',
    loading_renderer: '正在加载渲染器...',
    star: '收藏',
    interact: '互动',
    leave: '离开',
    freeze: '冻结',
    unfreeze: '解冻',
    freeze_title: '冻结世界后，agents 会先完成当前动作，然后才会真正停止。',
    music: '音乐',
    mute: '静音',
    music_title: '播放 AI 生成音乐（按 m 播放/静音）',
    select_agent_hint: '点击地图上的 agent 查看聊天历史。',
    start_conversation: '开始对话',
    waiting_accept: '等待对方接受...',
    walking_over: '正在靠近...',
    leave_conversation: '离开对话',
    accept: '接受',
    reject: '拒绝',
    this_is_you: '这是你！',
    conversing_with_you: '正在和你对话！',
    previous_conversation: '历史对话',
    joined_conversation: '加入了对话。',
    left_conversation: '离开了对话。',
    typing: '输入中...',
    type_here: '在这里输入',
    events_panel_title: '世界事件面板',
    events_panel_subtitle: '监控短周期地震和长周期城市更新，以及窗口内交互统计。',
    event_earthquake: '地震',
    event_city_update: '城市更新',
    status_active: '进行中',
    status_inactive: '未激活',
    started_at: '开始时间',
    ends_at: '结束时间',
    next_at: '下次触发',
    interactions_in_window: '当前/最近窗口交互量',
    top_event_types: '高频事件类型',
    top_actors: '高活跃 agents',
    top_dyads: '高频互动对',
    no_data: '暂无数据',
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = 'ai-town-language';

function detectDefaultLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'zh' || saved === 'en') {
    return saved;
  }
  const browserLang = window.navigator.language.toLowerCase();
  return browserLang.startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectDefaultLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
  }, [language]);

  const setLanguage = (next: Language) => setLanguageState(next);

  const t = (key: TranslationKey) => translations[language][key];

  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
