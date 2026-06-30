
const state={currentConversationId:null,currentAgentId:null,currentMode:localStorage.getItem('omniclient-agent-mode')||'General',agents:[],conversations:[],historyFilter:'recent',isStreaming:false,abortController:null,pendingFiles:[],virtualFiles:[],tasks:[],taskTimer:null,sidebarOpen:window.innerWidth>980,theme:localStorage.getItem('omniclient-theme')||'light',speechRecognition:null};
const $=(id)=>document.getElementById(id);
const agentModes=['General','Developer','Designer','Marketing','Research','Finance','SEO','Automation','Support','Legal','HR'];
const longPromptThreshold=1800,longLineThreshold=28;
window.addEventListener('DOMContentLoaded',init);
async function init(){applyTheme(state.theme);configureMarkdown();await loadAgents();await loadConversations();renderAgentMenu();setupEventListeners();initActionPills();setSidebar(state.sidebarOpen);showWelcomeScreen();await loadProjects();await loadBillingStatus();refreshIcons();}
function setupEventListeners(){
$('sidebar-toggle')?.addEventListener('click',()=>setSidebar(false));$('mobile-sidebar-toggle')?.addEventListener('click',()=>setSidebar(true));$('new-chat-btn')?.addEventListener('click',()=>startNewChat());$('open-command-btn')?.addEventListener('click',openCommandPalette);$('settings-btn')?.addEventListener('click',()=>openModal('settings-modal'));$('billing-badge')?.addEventListener('click',openBillingSettings);$('settings-theme-toggle')?.addEventListener('click',toggleTheme);$('more-btn')?.addEventListener('click',toggleMoreMenu);$('send-btn')?.addEventListener('click',()=>state.isStreaming?cancelStreaming():sendMessage());$('message-input')?.addEventListener('keydown',handleComposerKeydown);$('message-input')?.addEventListener('input',handleComposerInput);$('file-upload-btn')?.addEventListener('click',()=>$('file-input')?.click());$('file-input')?.addEventListener('change',handleFileSelection);$('voice-btn')?.addEventListener('click',toggleVoiceInput);$('agent-select-btn')?.addEventListener('click',toggleAgentMenu);$('command-input')?.addEventListener('input',renderCommandResults);$('sandbox-toggle')?.addEventListener('click',()=>$('sandbox-panel')?.classList.toggle('collapsed'));$('close-settings-btn')?.addEventListener('click',()=>closeModal('settings-modal'));$('close-db-modal-btn')?.addEventListener('click',()=>closeModal('db-modal'));$('db-shortcut-btn')?.addEventListener('click',()=>{closeModal('settings-modal');openModal('db-modal');});$('run-query-btn')?.addEventListener('click',runDbQuery);$('export-csv-btn')?.addEventListener('click',exportQueryCSV);
document.querySelectorAll('.history-tab').forEach((tab)=>tab.addEventListener('click',()=>setHistoryFilter(tab.dataset.filter)));document.querySelectorAll('.suggestions button').forEach((btn)=>btn.addEventListener('click',()=>startNewChat(null,btn.dataset.prompt||'')));document.querySelectorAll('.settings-tab').forEach((tab)=>tab.addEventListener('click',()=>activateSettingsTab(tab.dataset.tab)));$('more-menu')?.querySelectorAll('button').forEach((btn)=>btn.addEventListener('click',()=>handleMoreAction(btn.dataset.action)));document.addEventListener('keydown',handleGlobalKeys);document.addEventListener('click',handleDocumentClick);setupDropZone();}
function refreshIcons(){if(window.lucide)lucide.createIcons();}
function configureMarkdown(){if(window.marked)marked.setOptions({gfm:true,breaks:true,mangle:false,headerIds:false});}
function applyTheme(theme){const normalized=theme==='dark'?'dark':'light';state.theme=normalized;document.documentElement.dataset.theme=normalized;localStorage.setItem('omniclient-theme',normalized);refreshIcons();}
function toggleTheme(){applyTheme(state.theme==='dark'?'light':'dark');}
function setSidebar(open){state.sidebarOpen=open;$('sidebar')?.classList.toggle('collapsed',!open);}
async function loadConversations(){try{const res=await fetch('/api/conversations');state.conversations=await res.json();renderConversationList();}catch{showToast('Failed to load conversations','error');}}
function setHistoryFilter(filter){state.historyFilter=filter||'recent';document.querySelectorAll('.history-tab').forEach((tab)=>tab.classList.toggle('active',tab.dataset.filter===state.historyFilter));if(filter==='projects'){loadProjects();}else{renderConversationList();}}
function renderConversationList(){const list=$('conversations-list');if(!list)return;let conversations=[...state.conversations];if(state.historyFilter==='pinned')conversations=conversations.filter((c)=>c.pinned);if(state.historyFilter==='projects')conversations=conversations.filter((c)=>/project|build|app|site|automation/i.test(c.title||''));if(!conversations.length){list.innerHTML=`<div class="empty-history">${state.historyFilter==='recent'?'Start a new conversation.':'Nothing here yet.'}</div>`;return;}list.innerHTML=conversations.map(convHtml).join('');list.querySelectorAll('.conversation-item').forEach((item)=>item.addEventListener('click',(event)=>{if(event.target.closest('.conv-actions'))return;loadConversation(Number(item.dataset.id));}));list.querySelectorAll('.conv-pin-btn').forEach((btn)=>btn.addEventListener('click',togglePinConversation));list.querySelectorAll('.conv-delete-btn').forEach((btn)=>btn.addEventListener('click',deleteConversation));refreshIcons();}
function convHtml(c){return `<button class="conversation-item ${c.id===state.currentConversationId?'active':''}" type="button" data-id="${c.id}"><i data-lucide="${c.pinned?'pin':'message-circle'}"></i><span class="conv-title">${escapeHtml(c.title||'New Conversation')}</span><span class="conv-actions"><span class="conv-action-btn conv-pin-btn" data-id="${c.id}" title="${c.pinned?'Unpin':'Pin'}"><i data-lucide="${c.pinned?'pin-off':'pin'}"></i></span><span class="conv-action-btn conv-delete-btn danger" data-id="${c.id}" title="Delete"><i data-lucide="trash-2"></i></span></span></button>`;}
async function togglePinConversation(e){e.stopPropagation();const id=Number(e.currentTarget.dataset.id);const conv=state.conversations.find((c)=>c.id===id);await fetch(`/api/conversations/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pinned:!conv?.pinned})});await loadConversations();}
async function deleteConversation(e){e.stopPropagation();const id=Number(e.currentTarget.dataset.id);if(!confirm('Delete this conversation?'))return;await fetch(`/api/conversations/${id}`,{method:'DELETE'});if(state.currentConversationId===id){state.currentConversationId=null;showWelcomeScreen();}await loadConversations();}
async function loadConversation(id){state.currentConversationId=id;try{const res=await fetch(`/api/conversations/${id}`);const data=await res.json();$('chat-title').textContent=data.title||'Conversation';$('welcome-screen').classList.add('hidden');$('messages-container').classList.remove('hidden');$('messages-container').innerHTML='';for(const msg of data.messages||[])appendMessage(msg.role,msg.content,msg.id,msg.bookmarked);await loadConversations();scrollToBottom(true);if(window.innerWidth<=980)setSidebar(false);}catch{showToast('Failed to load conversation','error');}}
function startNewChat(_event=null,prefillMessage=''){exitWebsiteWorkspace();state.currentConversationId=null;$('chat-title').textContent='New Conversation';$('messages-container').innerHTML='';state.virtualFiles=[];state.pendingFiles=[];renderFilePreview();if(prefillMessage){$('welcome-screen').classList.add('hidden');$('messages-container').classList.remove('hidden');}else showWelcomeScreen();$('message-input').value=prefillMessage;autoResizeTextarea();$('message-input').focus();renderConversationList();if(window.innerWidth<=980)setSidebar(false);}
function showWelcomeScreen(){$('welcome-screen').classList.remove('hidden');$('messages-container').classList.add('hidden');$('chat-title').textContent='New Conversation';}
async function loadAgents(){try{const res=await fetch('/api/agents');const data=await res.json();state.agents=Array.isArray(data)?data:(data.agents||[]);}catch{state.agents=[{id:1,name:'OmniClient',description:'General AI Assistant'}];}if(!state.currentAgentId&&state.agents.length)state.currentAgentId=state.agents[0].id;}
function renderAgentMenu(){$('agent-mode-label').textContent=state.currentMode;const menu=$('agent-menu');if(!menu)return;menu.innerHTML=agentModes.map((mode)=>`<button class="agent-option ${mode===state.currentMode?'active':''}" type="button" role="option" data-mode="${mode}"><i data-lucide="${agentIcon(mode)}"></i><span>${mode}</span></button>`).join('');menu.querySelectorAll('.agent-option').forEach((btn)=>btn.addEventListener('click',()=>selectAgentMode(btn.dataset.mode)));refreshIcons();}
function agentIcon(mode){return({Developer:'code-2',Research:'book-open-search',Designer:'pen-tool',Marketing:'megaphone',Automation:'workflow',Finance:'chart-no-axes-combined',SEO:'search-check',Support:'headphones',Legal:'scale',HR:'contact-round'})[mode]||'sparkles';}
function toggleAgentMenu(){$('agent-menu')?.classList.toggle('open');$('agent-select-btn')?.setAttribute('aria-expanded',String($('agent-menu')?.classList.contains('open')));}
function selectAgentMode(mode){state.currentMode=mode||'General';localStorage.setItem('omniclient-agent-mode',state.currentMode);$('agent-menu')?.classList.remove('open');$('agent-select-btn')?.setAttribute('aria-expanded','false');renderAgentMenu();}
function handleComposerKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}
function handleComposerInput(){autoResizeTextarea();maybeVirtualizePrompt();}
function maybeVirtualizePrompt(){const input=$('message-input');if(!input)return;const value=input.value;const lineCount=value.split('\n').length;if(value.length<longPromptThreshold&&lineCount<longLineThreshold)return;const virtualFile=createVirtualFile(value);state.virtualFiles.push(virtualFile);input.value='';autoResizeTextarea();renderFilePreview();showToast(`${virtualFile.name} attached as context`,'success');}
function createVirtualFile(content){const kind=detectVirtualFileKind(content);const index=state.virtualFiles.length+1;return{id:`virtual-${Date.now()}-${index}`,name:`${kind.base}-${index}.${kind.ext}`,size:new Blob([content]).size,type:kind.type,virtual:true,content};}
function detectVirtualFileKind(text){const trimmed=text.trim();if(/^\s*[{[]/.test(trimmed))return{base:'data',ext:'json',type:'JSON'};if(/^---\n|:\s*\n\s+-\s/.test(trimmed))return{base:'config',ext:'yaml',type:'YAML'};if(/^#\s|```|^\|.+\|/m.test(trimmed))return{base:'notes',ext:'md',type:'Markdown'};if(/Traceback|ERROR|WARN|INFO|\[[0-9: -]+\]/i.test(trimmed))return{base:'server',ext:'log',type:'Log'};if(/def\s+\w+\(|import\s+\w+|from\s+\w+\s+import/.test(trimmed))return{base:'script',ext:'py',type:'Python'};if(/const\s+\w+|function\s+\w+|=>|import .* from/.test(trimmed))return{base:'app',ext:'js',type:'JavaScript'};if(/,/.test(trimmed.split('\n')[0]||'')&&trimmed.split('\n').length>4)return{base:'table',ext:'csv',type:'CSV'};return{base:'document',ext:'txt',type:'Text'};}
async function sendMessage(){const input=$('message-input');const typedMessage=input.value.trim();if(!typedMessage&&!state.virtualFiles.length&&!state.pendingFiles.length)return;if(state.isStreaming)return;if(isWebsiteBuildRequest(typedMessage)){input.value='';autoResizeTextarea();openWebsiteWorkspace(createMockWebsiteProject(typedMessage));return;}const payloadMessage=buildPayloadMessage(typedMessage);const displayMessage=typedMessage||`Attached ${state.virtualFiles.length+state.pendingFiles.length} file${state.virtualFiles.length+state.pendingFiles.length===1?'':'s'}.`;input.value='';autoResizeTextarea();$('welcome-screen').classList.add('hidden');$('messages-container').classList.remove('hidden');appendMessage('user',displayMessage,null,false,false,[...state.virtualFiles,...state.pendingFiles]);setStreamingUi(true);startSandboxTask(inferTaskName(payloadMessage));const skeletonId=showSkeleton();state.abortController=new AbortController();let assistantEl=null;let rawContent='';try{const res=await fetch('/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},signal:state.abortController.signal,body:JSON.stringify({message:payloadMessage,conversation_id:state.currentConversationId,agent_id:state.currentAgentId})});removeElement(skeletonId);if(!res.ok){const err=await res.json().catch(()=>({}));if(res.status===402){showLimitExceededWarning(err.detail?.billing);await loadBillingStatus();throw new Error(err.detail?.message||'Free plan limit reached.');}throw new Error(typeof err.detail==='string'?err.detail:(err.detail?.message||`HTTP ${res.status}`));}if(!res.body)throw new Error('Streaming is not available in this browser.');assistantEl=appendMessage('assistant','',null,false,true);const contentEl=assistantEl.querySelector('.message-content');const reader=res.body.getReader();const decoder=new TextDecoder();let buffer='';while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const events=buffer.split('\n\n');buffer=events.pop()||'';for(const eventText of events){const payload=parseSsePayload(eventText);if(!payload)continue;if(payload.type==='meta')state.currentConversationId=payload.conversation_id;if(payload.type==='text'||payload.type==='token'){rawContent+=cleanDisplayContent(payload.content||'');renderMessageContent(contentEl,rawContent);scrollToBottom();}else if(payload.type==='progress'){renderStreamProgress(payload);}}}if(!rawContent.trim()){assistantEl?.remove();appendMessage('assistant','**No response returned.** Please check the active model and API configuration.');}else{assistantEl.classList.remove('streaming');assistantEl.querySelector('.thinking-badge')?.remove();assistantEl.querySelector('.stream-cursor')?.remove();await enhanceMarkdown(assistantEl);}completeSandboxTask('Completed');await loadConversations();}catch(error){removeElement(skeletonId);if(assistantEl&&!rawContent.trim())assistantEl.remove();const msg=error.name==='AbortError'?'Generation cancelled.':`**Connection error:** ${error.message}`;appendMessage('assistant',msg);completeSandboxTask(error.name==='AbortError'?'Cancelled':'Needs attention',true);showToast(error.name==='AbortError'?'Generation cancelled':error.message,error.name==='AbortError'?'warning':'error');}finally{setStreamingUi(false);state.abortController=null;state.virtualFiles=[];state.pendingFiles=[];renderFilePreview();scrollToBottom();}}
function buildPayloadMessage(message){const modeInstruction=`[Agent mode: ${state.currentMode}]\nAll code execution, browser automation, document conversion, and generation tasks must be planned for the E2B Sandbox. The browser UI is progress-only.\n`;const virtualContext=state.virtualFiles.map((file)=>`\n\n[Virtual attachment: ${file.name} | ${file.type} | ${formatFileSize(file.size)}]\n${file.content}`).join('');const fileContext=state.pendingFiles.map((file)=>`\n\n[Attached file reference: ${file.name} | ${file.type||'unknown'} | ${formatFileSize(file.size)}]`).join('');return`${modeInstruction}\n${message||'Use the attached context.'}${virtualContext}${fileContext}`;}
function inferTaskName(message){if(/deploy/i.test(message))return'Deploying';if(/website|landing|dashboard|app|ui/i.test(message))return'Building Workspace';if(/pdf|docx|presentation|pptx|slides/i.test(message))return'Generating Document';if(/research|source|analy/i.test(message))return'Researching';if(/api|code|python|node|debug/i.test(message))return'Running Sandbox';return'Thinking';}
function renderStreamProgress(payload){const label=payload.step||payload.phase||payload.status||'Working';const panel=$('sandbox-panel');if(panel){$('sandbox-summary-text').textContent=String(label).replace(/[-_]/g,' ')+'...';panel.classList.remove('idle');}}function parseSsePayload(eventText){const data=eventText.split('\n').filter((line)=>line.startsWith('data:')).map((line)=>line.slice(5).trim()).join('\n');if(!data||data==='[DONE]')return null;try{return JSON.parse(data);}catch{return null;}}
function setStreamingUi(isStreaming){state.isStreaming=isStreaming;$('send-btn').classList.toggle('is-generating',isStreaming);$('send-btn').innerHTML=`<i data-lucide="${isStreaming?'square':'send'}"></i>`;refreshIcons();}
function cancelStreaming(){state.abortController?.abort();}
function showSkeleton(){const id=`skeleton-${Date.now()}`;const el=document.createElement('article');el.id=id;el.className='message-wrapper assistant';el.innerHTML=`<div class="message-meta"><span class="message-role"><span class="thinking-badge"></span>OmniClient</span></div><div class="message-bubble"><div class="message-content"><p>Preparing...</p></div></div>`;$('messages-container').appendChild(el);scrollToBottom(true);return id;}
function removeElement(id){const el=$(id);if(el)el.remove();}
function appendMessage(role,content,msgId=null,bookmarked=false,streaming=false,files=[]){const wrapper=document.createElement('article');wrapper.className=`message-wrapper ${role}${streaming?' streaming':''}`;if(msgId)wrapper.dataset.msgId=msgId;const isUser=role==='user';const fileHtml=files.length?`<div class="message-files">${files.map(fileChipHtml).join('')}</div>`:'';wrapper.innerHTML=`<div class="message-meta"><span class="message-role">${streaming?'<span class="thinking-badge"></span>':`<i data-lucide="${isUser?'user':'sparkles'}"></i>`}${isUser?'You':'OmniClient'}</span><span>${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div><div class="message-bubble"><div class="message-content"></div>${streaming?'<span class="stream-cursor"></span>':''}${fileHtml}</div><div class="message-actions">${!isUser?'<button class="msg-action-btn regen-btn" type="button"><i data-lucide="rotate-ccw"></i>Regenerate</button>':''}${msgId?`<button class="msg-action-btn bookmark-btn ${bookmarked?'bookmarked':''}" data-id="${msgId}" type="button"><i data-lucide="bookmark"></i>${bookmarked?'Bookmarked':'Bookmark'}</button><button class="msg-action-btn delete-msg-btn" data-id="${msgId}" type="button"><i data-lucide="trash-2"></i>Delete</button>`:''}<button class="msg-action-btn copy-msg-btn" type="button"><i data-lucide="copy"></i>Copy</button></div>`;$('messages-container').appendChild(wrapper);renderMessageContent(wrapper.querySelector('.message-content'),cleanDisplayContent(content||''));bindMessageActions(wrapper);refreshIcons();scrollToBottom();return wrapper;}
function fileChipHtml(file){return`<span class="file-chip"><i data-lucide="file-text"></i>${escapeHtml(file.name)}<small>${formatFileSize(file.size)}</small></span>`;}
function renderMessageContent(el,content){if(!el)return;el.innerHTML=renderMarkdown(content||'');enhanceMarkdown(el.parentElement||el);}
function renderMarkdown(text){if(!text)return'';let source=text.replace(/```([\w#+.-]*)\n?([\s\S]*?)```/g,(_,lang,code)=>{const language=(lang||'text').trim()||'text';const encoded=encodeURIComponent(code);const escapedCode=escapeHtml(code);return`<div class="code-block-wrapper"><div class="code-block-header"><span>${escapeHtml(language)}</span><span class="code-actions"><button class="code-copy-btn" data-code="${encoded}" type="button">Copy</button><button class="code-download-btn" data-lang="${escapeHtml(language)}" data-code="${encoded}" type="button">Download</button><button class="code-run-btn" data-code="${encoded}" type="button">Run</button><button class="code-open-btn" data-code="${encoded}" type="button">Open in Sandbox</button></span></div><pre class="language-${escapeHtml(language)}"><code class="language-${escapeHtml(language)}">${escapedCode}</code></pre></div>`;});if(window.marked){try{return marked.parse(source);}catch{}}return fallbackMarkdown(source);}
async function enhanceMarkdown(scope){if(!scope)return;if(window.Prism)Prism.highlightAllUnder(scope);scope.querySelectorAll('.code-copy-btn').forEach((btn)=>btn.onclick=async()=>{await navigator.clipboard.writeText(decodeURIComponent(btn.dataset.code||''));btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy',1200);});scope.querySelectorAll('.code-download-btn').forEach((btn)=>btn.onclick=()=>downloadCode(btn.dataset.code||'',btn.dataset.lang||'txt'));scope.querySelectorAll('.code-run-btn, .code-open-btn').forEach((btn)=>btn.onclick=()=>{startSandboxTask(btn.classList.contains('code-run-btn')?'Running Code':'Opening Sandbox');setTimeout(()=>completeSandboxTask('Ready'),900);});}
function downloadCode(encodedCode,lang){const safeLang=String(lang||'txt').replace(/[^a-z0-9]/gi,'').toLowerCase()||'txt';const extension=({javascript:'js',typescript:'ts',python:'py',bash:'sh',json:'json',yaml:'yml',sql:'sql'})[safeLang]||'txt';const url=URL.createObjectURL(new Blob([decodeURIComponent(encodedCode)],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=`omniclient-code.${extension}`;a.click();URL.revokeObjectURL(url);}
function fallbackMarkdown(text){return escapeHtml(text).split(/\n{2,}/).map((part)=>`<p>${part.replace(/\n/g,'<br>')}</p>`).join('');}
function bindMessageActions(wrapper){wrapper.querySelector('.copy-msg-btn')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(wrapper.querySelector('.message-content')?.innerText||'');showToast('Copied to clipboard','success');});wrapper.querySelector('.regen-btn')?.addEventListener('click',async()=>{const prev=wrapper.previousElementSibling?.querySelector('.message-content')?.innerText;if(prev){wrapper.remove();$('message-input').value=prev;await sendMessage();}});wrapper.querySelector('.bookmark-btn')?.addEventListener('click',async(e)=>{const id=e.currentTarget.dataset.id;const res=await fetch(`/api/messages/${id}/bookmark`,{method:'PATCH'});const data=await res.json();e.currentTarget.classList.toggle('bookmarked',Boolean(data.bookmarked));e.currentTarget.innerHTML=`<i data-lucide="bookmark"></i>${data.bookmarked?'Bookmarked':'Bookmark'}`;refreshIcons();});wrapper.querySelector('.delete-msg-btn')?.addEventListener('click',async(e)=>{if(!confirm('Delete this message?'))return;await fetch(`/api/messages/${e.currentTarget.dataset.id}`,{method:'DELETE'});wrapper.remove();});}
function handleFileSelection(event){const files=Array.from(event.target.files||[]);if(!files.length)return;state.pendingFiles=[...state.pendingFiles,...files.map((file)=>({name:file.name,size:file.size,type:file.type||'unknown'}))];renderFilePreview();showToast(`${files.length} file${files.length>1?'s':''} attached`,'success');if($('file-input'))$('file-input').value='';}
function renderFilePreview(){const row=$('file-preview-row');if(!row)return;const files=[...state.virtualFiles,...state.pendingFiles];row.classList.toggle('hidden',!files.length);row.innerHTML=files.map((file)=>`<span class="file-chip"><i data-lucide="${file.virtual?'file-text':'paperclip'}"></i>${escapeHtml(file.name)}<small>${formatFileSize(file.size)}</small><button type="button" data-id="${escapeHtml(file.id||file.name)}" aria-label="Remove file"><i data-lucide="x"></i></button></span>`).join('');row.querySelectorAll('button').forEach((btn)=>btn.addEventListener('click',()=>removeAttachedFile(btn.dataset.id)));refreshIcons();}
function removeAttachedFile(id){state.virtualFiles=state.virtualFiles.filter((file)=>file.id!==id);state.pendingFiles=state.pendingFiles.filter((file)=>file.name!==id);renderFilePreview();}
function formatFileSize(bytes){if(!bytes)return'0 B';const units=['B','KB','MB','GB'];const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);return`${(bytes/Math.pow(1024,i)).toFixed(i?1:0)} ${units[i]}`;}
function setupDropZone(){const shell=$('composer-shell');if(!shell)return;['dragenter','dragover'].forEach((type)=>shell.addEventListener(type,(e)=>{e.preventDefault();shell.classList.add('drag-over');}));['dragleave','drop'].forEach((type)=>shell.addEventListener(type,()=>shell.classList.remove('drag-over')));shell.addEventListener('drop',(e)=>{e.preventDefault();if(e.dataTransfer?.files?.length)handleFileSelection({target:{files:e.dataTransfer.files}});});document.addEventListener('paste',(e)=>{const files=Array.from(e.clipboardData?.files||[]);if(files.length)handleFileSelection({target:{files}});});}
function toggleVoiceInput(){const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition)return showToast('Voice input is not supported in this browser.','warning');if(state.speechRecognition){state.speechRecognition.stop();return;}const recognition=new SpeechRecognition();recognition.lang='en-US';recognition.interimResults=true;state.speechRecognition=recognition;$('voice-btn')?.classList.add('recording');const base=$('message-input').value;recognition.onresult=(event)=>{let text='';for(let i=event.resultIndex;i<event.results.length;i++)text+=event.results[i][0]?.transcript||'';$('message-input').value=`${base}${base?' ':''}${text}`;handleComposerInput();};recognition.onend=()=>{state.speechRecognition=null;$('voice-btn')?.classList.remove('recording');};recognition.start();}
function openCommandPalette(){$('command-overlay').classList.add('open');$('command-input').value='';renderCommandResults();setTimeout(()=>$('command-input')?.focus(),30);}
function closeCommandPalette(){$('command-overlay').classList.remove('open');}
function renderCommandResults(){const q=($('command-input')?.value||'').toLowerCase();const commands=[{icon:'message-square-plus',title:'New chat',group:'Commands',action:()=>startNewChat()},{icon:'settings',title:'Settings',group:'Settings',action:()=>openModal('settings-modal')},{icon:'sun-moon',title:'Toggle appearance',group:'Settings',action:toggleTheme},{icon:'database',title:'Developer database query',group:'Developer',action:()=>openModal('db-modal')},{icon:'folder',title:'Projects',group:'Projects',action:()=>setHistoryFilter('projects')},{icon:'file-search',title:'Attach files',group:'Files',action:()=>$('file-input')?.click()},...agentModes.map((mode)=>({icon:agentIcon(mode),title:`${mode} agent`,group:'Agents',action:()=>selectAgentMode(mode)})),...state.conversations.map((c)=>({icon:c.pinned?'pin':'message-circle',title:c.title||'Conversation',group:'Chats',action:()=>loadConversation(c.id)}))].filter((item)=>`${item.title} ${item.group}`.toLowerCase().includes(q));$('command-results').innerHTML=commands.slice(0,18).map((item,index)=>`<button class="command-result" type="button" data-index="${index}"><i data-lucide="${item.icon}"></i><span>${escapeHtml(item.title)}</span></button>`).join('');$('command-results').querySelectorAll('.command-result').forEach((el)=>el.addEventListener('click',()=>{commands[Number(el.dataset.index)].action();closeCommandPalette();}));refreshIcons();}
function toggleMoreMenu(){$('more-menu')?.classList.toggle('open');}
function handleMoreAction(action){$('more-menu')?.classList.remove('open');if(action==='rename')renameConversation();if(action==='export')exportConversation();if(action==='theme')toggleTheme();if(action==='database')openModal('db-modal');}
async function renameConversation(){if(!state.currentConversationId)return showToast('Start a conversation first','warning');const title=prompt('Conversation title',$('chat-title').textContent||'New Conversation');if(!title)return;const res=await fetch(`/api/conversations/${state.currentConversationId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});if(res.ok){$('chat-title').textContent=title;await loadConversations();}}
async function exportConversation(){if(!state.currentConversationId)return showToast('No active conversation','warning');const a=document.createElement('a');a.href=`/api/conversations/${state.currentConversationId}/export?fmt=markdown`;a.download=`conversation_${state.currentConversationId}.md`;a.click();}
function openModal(id){$(`${id}-overlay`)?.classList.add('open');refreshIcons();}
function closeModal(id){$(`${id}-overlay`)?.classList.remove('open');}
function activateSettingsTab(tab){document.querySelectorAll('.settings-tab').forEach((el)=>el.classList.toggle('active',el.dataset.tab===tab));document.querySelectorAll('.settings-panel').forEach((el)=>el.classList.toggle('active',el.dataset.panel===tab));}
let lastQueryResults=null;
async function runDbQuery(){const sql=$('db-query-input').value.trim();if(!sql)return;const res=await fetch('/api/query-db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql})});const data=await res.json();if(!res.ok){$('db-results').innerHTML=`<div class="empty-history">${escapeHtml(data.detail||'Query failed')}</div>`;return;}lastQueryResults=data;$('db-row-count').textContent=`${data.row_count} rows`;$('export-csv-btn').classList.remove('hidden');if(!data.rows?.length){$('db-results').innerHTML='<div class="empty-history">Query returned no rows.</div>';return;}const head=`<tr>${data.columns.map((c)=>`<th>${escapeHtml(c)}</th>`).join('')}</tr>`;const rows=data.rows.map((row)=>`<tr>${data.columns.map((c)=>`<td>${escapeHtml(String(row[c]??''))}</td>`).join('')}</tr>`).join('');$('db-results').innerHTML=`<table class="db-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;$('query-explanation').textContent=`Read-only query executed: ${sql.slice(0,140)}`;}
function exportQueryCSV(){if(!lastQueryResults)return;const{columns,rows}=lastQueryResults;const csv=[columns.join(','),...rows.map((row)=>columns.map((c)=>`"${String(row[c]??'').replace(/"/g,'""')}"`).join(','))].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='query-results.csv';a.click();URL.revokeObjectURL(url);}
function startSandboxTask(title){const task={id:`task-${Date.now()}`,title,status:'Running',progress:8};state.tasks=[task];renderTasks();if(state.taskTimer)clearInterval(state.taskTimer);state.taskTimer=setInterval(()=>{const active=state.tasks[0];if(!active||active.progress>=92||!state.isStreaming)return;active.progress=Math.min(92,active.progress+Math.random()*12);renderTasks();},650);}
function completeSandboxTask(status,error=false){if(state.taskTimer)clearInterval(state.taskTimer);const active=state.tasks[0];if(!active)return;active.status=status;active.progress=error?active.progress:100;renderTasks();setTimeout(()=>{state.tasks=[];renderTasks();},error?4500:1800);}
function renderTasks(){const panel=$('sandbox-panel');const list=$('task-list');if(!panel||!list)return;panel.classList.toggle('idle',!state.tasks.length);const active=state.tasks[0];$('sandbox-summary-text').textContent=active?`${active.title}...`:'Sandbox idle';list.innerHTML=state.tasks.map((task)=>`<div class="task-card"><div class="task-title"><span>${escapeHtml(task.title)}</span><span>${escapeHtml(task.status)}</span></div><div class="task-progress" style="--progress: ${Math.round(task.progress)}%"><span></span></div><div class="task-actions"><button type="button" data-action="cancel">Cancel</button><button type="button" data-action="retry">Retry</button><button type="button" data-action="logs">Logs</button></div></div>`).join('');list.querySelectorAll('button').forEach((btn)=>btn.addEventListener('click',()=>showToast(`${btn.dataset.action} is handled by the sandbox task manager.`,'info')));refreshIcons();}
function handleGlobalKeys(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandPalette();}if(e.key==='Escape'){closeCommandPalette();closeSFModal();$('agent-menu')?.classList.remove('open');$('more-menu')?.classList.remove('open');document.querySelectorAll('.modal-overlay.open').forEach((el)=>el.classList.remove('open'));}if(!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='n'&&document.activeElement===document.body)startNewChat();}
function handleDocumentClick(e){if(e.target.classList.contains('overlay'))closeCommandPalette();if(e.target.classList.contains('modal-overlay'))e.target.classList.remove('open');if(!e.target.closest('.agent-menu-wrap'))$('agent-menu')?.classList.remove('open');if(!e.target.closest('#more-btn')&&!e.target.closest('#more-menu'))$('more-menu')?.classList.remove('open');}
function showToast(message,type='info'){const toast=document.createElement('div');toast.className=`toast ${type}`;toast.innerHTML=`<i data-lucide="${type==='success'?'check-circle-2':type==='error'?'circle-alert':type==='warning'?'triangle-alert':'info'}"></i><span>${escapeHtml(message)}</span>`;$('toast-container').appendChild(toast);refreshIcons();setTimeout(()=>{toast.classList.add('leaving');setTimeout(()=>toast.remove(),200);},2800);}
function scrollToBottom(force=false){const container=$('messages-container');if(!container)return;const distance=container.scrollHeight-container.scrollTop-container.clientHeight;if(!force&&distance>240)return;requestAnimationFrame(()=>container.scrollTo({top:container.scrollHeight,behavior:force?'auto':'smooth'}));}
function autoResizeTextarea(){const textarea=$('message-input');if(!textarea)return;textarea.style.height='auto';textarea.style.height=`${Math.min(textarea.scrollHeight,320)}px`;}
function stripHtmlTags(text){return String(text||'').replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");}
function cleanDisplayContent(text){return stripHtmlTags(text).replace(/\[TOOL:[^\]]*\]/g,'').replace(/\[THINKING:[^\]]*\]/g,'').replace(/\n{3,}/g,'\n\n');}
function escapeHtml(text){return String(text??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}


/* ═══════════════════════════════════════════════════════
   PRESENTATION SYSTEM
   ═══════════════════════════════════════════════════════ */

// Slide builder state
var sbTemplate = 'Editorial';
var sbTone = 'Professional';

/* Open/close the inline slide builder accordion */
function openSFModal(prefillTopic) {
  openSlideBuilder(null, prefillTopic);
}

function closeSFModal() {
  closeSlideBuilder();
}

function toggleSlideBuilderAccordion(event) {
  openSlideBuilder(event);
}

function openSlideBuilder(event, prefillTopic) {
  if (event) event.preventDefault();
  var panel = document.getElementById('sf-modal');
  if (!panel) return;
  var shouldOpen = Boolean(prefillTopic) || !panel.classList.contains('open');
  panel.classList.toggle('open', shouldOpen);
  panel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
  $('pill-slides')?.classList.toggle('active', shouldOpen);
  var input = document.getElementById('sb-topic');
  if (input && prefillTopic) input.value = prefillTopic;
  var btn = document.getElementById('sb-generate-btn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="sparkles"></i><span>Generate Presentation</span>'; }
  refreshIcons();
  if (shouldOpen) setTimeout(function () { if (input) input.focus(); }, 120);
}

function closeSlideBuilder() {
  var panel = document.getElementById('sf-modal');
  if (panel) {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
  $('pill-slides')?.classList.remove('active');
}


function setSBTopic(btn) {
  var input = document.getElementById('sb-topic');
  if (input) { input.value = btn.textContent.trim(); input.focus(); }
}

// Select template card
function selectSBTemplate(card) {
  document.querySelectorAll('.template-card').forEach(function (c) { c.classList.remove('selected'); });
  card.classList.add('selected');
  sbTemplate = card.dataset.template || 'Editorial';
}

// Select tone option
function selectSBTone(btn) {
  document.querySelectorAll('.sb-tone-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  sbTone = btn.dataset.tone || 'Professional';
}

async function generatePresentation() {
  var topic = (document.getElementById('sb-topic') || {}).value || '';
  topic = topic.trim();
  if (!topic) { showToast('Please enter a presentation topic first', 'warning'); return; }

  var slideCount = parseInt((document.getElementById('sb-slide-count') || {}).value || '10', 10);
  var btn = document.getElementById('sb-generate-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-circle"></i><span>Initializing...</span>'; refreshIcons(); }

  closeSFModal();
  // Show messages container without clearing existing chat
  var welcomeEl = document.getElementById('welcome-screen');
  var msgEl = document.getElementById('messages-container');
  if (welcomeEl) welcomeEl.classList.add('hidden');
  if (msgEl) msgEl.classList.remove('hidden');
  appendMessage('user', 'Create a presentation: ' + topic + ' (' + slideCount + ' slides, ' + sbTemplate + ' template, ' + sbTone + ' tone)');

  // 1. Append Assistant Progress Tracker Placeholder
  const trackerId = 'tracker-' + Date.now();
  const wrapper = document.createElement('article');
  wrapper.className = `message-wrapper assistant streaming`;
  wrapper.id = trackerId;
  
  wrapper.innerHTML = `
    <div class="message-meta">
      <span class="message-role"><span class="thinking-badge"></span>OmniClient Presentation Agent</span>
      <span>Generating</span>
    </div>
    <div class="message-bubble">
      <div class="message-content"></div>
    </div>
  `;
  const trackerTemplate = document.getElementById('agentic-tracker-template');
  const trackerContent = trackerTemplate ? trackerTemplate.content.cloneNode(true) : document.createTextNode('Preparing presentation...');
  wrapper.querySelector('.message-content').appendChild(trackerContent);
  $('messages-container').appendChild(wrapper);  refreshIcons();
  scrollToBottom();

  // Timer variables
  let activeStep = 'research';
  let stepTimers = { research: 0, outline: 0, generating: 0, deliver: 0 };
  let timerInterval = setInterval(() => {
    if (activeStep) {
      stepTimers[activeStep] += 0.1;
      const timerEl = wrapper.querySelector(`#step-${activeStep} .step-timer`);
      if (timerEl) timerEl.textContent = stepTimers[activeStep].toFixed(1) + 's';
    }
  }, 100);

  function setStepActive(stepId) {
    activeStep = stepId;
    const stepEl = wrapper.querySelector(`#step-${stepId}`);
    if (!stepEl) return;
    stepEl.classList.add('active');
    stepEl.classList.remove('complete');
    const statusIcon = stepEl.querySelector('.step-status-icon');
    if (statusIcon) statusIcon.innerHTML = `<span class="thinking-badge"></span>`;
  }

  function setStepCompleted(stepId) {
    const stepEl = wrapper.querySelector(`#step-${stepId}`);
    if (!stepEl) return;
    stepEl.classList.remove('active');
    stepEl.classList.add('complete');
    const statusIcon = stepEl.querySelector('.step-status-icon');
    if (statusIcon) statusIcon.innerHTML = `<i data-lucide="check"></i>`;
    refreshIcons();
  }
  setStepActive('research');

  try {
    const res = await fetch('/api/presentations/generate/stream', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        topic: topic,
        template: sbTemplate,
        slide_count: slideCount,
        conversation_id: state.currentConversationId || null
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventText of events) {
        const payload = parseSsePayload(eventText);
        if (!payload) continue;

        if (payload.type === 'meta') {
          state.currentConversationId = payload.conversation_id;
        }

        if (payload.type === 'progress') {
          if (payload.phase === 'researching') {
            if (payload.query) {
              wrapper.querySelector('#status-research-details').textContent = `Searching: "${payload.query}"...`;
            } else if (payload.status === 'completed') {
              wrapper.querySelector('#status-research-details').innerHTML = `<strong>Research complete.</strong> Synthesized findings.`;
              setStepCompleted('research');
              setStepActive('outline');
            }
          }

          if (payload.phase === 'outlining') {
            const outlineDetails = wrapper.querySelector('#status-outline-details');
            if (outlineDetails && payload.slides) {
              outlineDetails.classList.remove('hidden');
              outlineDetails.innerHTML = payload.slides.map(s => 
                `<div><strong>Slide ${s.slide_number}:</strong> ${escapeHtml(s.title)}</div>`
              ).join('');
            }
          }

          if (payload.phase === 'generating') {
            if (activeStep === 'outline') {
              setStepCompleted('outline');
              setStepActive('generating');
              wrapper.querySelector('#status-generating-details').classList.remove('hidden');
              wrapper.querySelector('#live-slides-container').classList.remove('hidden');
            }

            wrapper.querySelector('#status-generating-details').textContent = `${payload.slide_number} / ${payload.total} slides constructed`;
            
            const slideContainer = wrapper.querySelector('#live-slides-container');
            if (slideContainer && payload.slide_html) {
              const div = document.createElement('div');
              div.className = 'slide-preview-wrapper';

              div.innerHTML = payload.slide_html;
              slideContainer.appendChild(div);
              scrollToBottom();
            }
          }

          if (payload.phase === 'done') {
            setStepCompleted('generating');
            setStepActive('deliver');
            
            clearInterval(timerInterval);
            setStepCompleted('deliver');
            activeStep = null;

            const finalCard = buildPresCardHtml(payload);
            const messageBubble = wrapper.querySelector('.message-content');
            
            wrapper.querySelector('#status-research-details').classList.add('hidden');
            wrapper.querySelector('#status-outline-details').classList.add('hidden');
            wrapper.querySelector('#status-generating-details').classList.add('hidden');
            wrapper.querySelector('#live-slides-container').classList.add('hidden');
            
            const doneNode = document.createElement('div');
            doneNode.className = "presentation-done";
            doneNode.innerHTML = `<p>Your presentation is ready.</p>${finalCard}`;
            messageBubble.appendChild(doneNode);
            
            wrapper.classList.remove('streaming');
            wrapper.querySelector('.thinking-badge')?.remove();
            
            showToast('Presentation generated successfully!', 'success');
            await loadProjects();
            refreshIcons();
            scrollToBottom();
          }
        }
      }
    }
  } catch (error) {
    clearInterval(timerInterval);
    const messageBubble = wrapper.querySelector('.message-content');
    if (messageBubble) {
      const errNode = document.createElement('div');
      errNode.className = "tracker-error";
      errNode.textContent = `Presentation build failed: ${error.message}`;
      messageBubble.appendChild(errNode);
    }
    showToast(`Generation failed: ${error.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="sparkles"></i><span>Generate Presentation</span>'; refreshIcons(); }
  }
}

function buildPresCardHtml(data) {
  var ago = data.created_at ? timeAgo(data.created_at) : 'just now';
  return '<div class="pres-result-card">' +
    '<span class="pres-result-card-icon">📊</span>' +
    '<div class="pres-result-card-info">' +
      '<div class="pres-result-card-title">' + escapeHtml(data.title || data.topic) + '</div>' +
      '<div class="pres-result-card-meta">' + escapeHtml(data.template) + ' · ' + data.slide_count + ' slides · ' + ago + '</div>' +
    '</div>' +
    '<div class="pres-result-actions">' +
      '<button class="composer-icon" title="Preview slides" onclick="openSlidesPreview(' + data.id + ', ' + JSON.stringify(JSON.stringify(data.slides || [])) + ')"><i data-lucide="eye"></i></button>' +
      '<a href="/api/presentations/' + data.id + '/pptx" class="composer-icon" title="Download PPTX" download><i data-lucide="download"></i></a>' +
      '<button class="composer-icon" title="Delete" onclick="deletePresentation(' + data.id + ', this)"><i data-lucide="trash-2"></i></button>' +
    '</div>' +
  '</div>';
}

function openSlidesPreview(id, slidesJsonStr) {
  var overlay = document.getElementById('slides-modal-overlay');
  var frame = document.getElementById('slides-modal-frame');
  if (!overlay || !frame) return;
  var slidesJson = [];
  try { slidesJson = JSON.parse(slidesJsonStr); } catch (e) {}
  var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(slidesJson))));
  frame.src = '/slides-preview?id=' + id + '&data=' + b64 + '&editor=true';
  overlay.classList.remove('hidden');
}

function closeSlidesModal(event) {
  if (event && event.target !== document.getElementById('slides-modal-overlay') && !event.target.classList.contains('slides-modal-close')) return;
  var overlay = document.getElementById('slides-modal-overlay');
  if (overlay) { overlay.classList.add('hidden'); }
  var frame = document.getElementById('slides-modal-frame');
  if (frame) frame.src = 'about:blank';
}

async function deletePresentation(id, btn) {
  if (!confirm('Delete this presentation?')) return;
  if (btn) btn.disabled = true;
  try {
    await fetch('/api/presentations/' + id, {method: 'DELETE'});
    // Remove card from DOM
    var card = btn ? btn.closest('.pres-result-card') : null;
    if (card) card.remove();
    await loadProjects();
    showToast('Presentation deleted', 'success');
  } catch (e) {
    showToast('Delete failed', 'error');
    if (btn) btn.disabled = false;
  }
}

// Projects tab — load real presentations from API
var projectsCache = [];
async function loadProjects() {
  try {
    var res = await fetch('/api/presentations');
    projectsCache = await res.json();
  } catch (e) {
    projectsCache = [];
  }
  if (state.historyFilter === 'projects') renderProjectList();
  renderWelcomeProjects();
}

function renderProjectList() {
  var list = document.getElementById('conversations-list');
  if (!list) return;
  if (!projectsCache.length) {
    list.innerHTML = '<div class="empty-history"><div>No presentations yet.</div><button class="sample-prompt-btn" style="margin-top:8px" onclick="openSFModal()">+ Create one</button></div>';
    return;
  }
  list.innerHTML = projectsCache.map(function (p) {
    var ago = p.created_at ? timeAgo(p.created_at) : '';
    return '<div class="project-card">' +
      '<span class="project-card-icon">&#x1F4CA;</span>' +
      '<div class="project-card-info">' +
        '<div class="project-card-title">' + escapeHtml(p.title || p.topic) + '</div>' +
        '<div class="project-card-meta">' + escapeHtml(p.template) + ' &middot; ' + p.slide_count + ' slides &middot; ' + ago + '</div>' +
      '</div>' +
      '<div class="project-card-actions">' +
        '<button class="proj-action-btn" title="Preview" onclick="openSlidesPreview(' + p.id + ', \'' + escapeHtml(JSON.stringify(p.slides || [])).replace(/'/g, "\\'") + '\')"><i data-lucide="eye"></i></button>' +
        '<a href="/api/presentations/' + p.id + '/pptx" class="proj-action-btn" title="Download" download><i data-lucide="download"></i></a>' +
        '<button class="proj-action-btn danger" title="Delete" onclick="deletePresentationFromList(' + p.id + ')"><i data-lucide="trash-2"></i></button>' +
      '</div>' +
    '</div>';
  }).join('');
  refreshIcons();
}

async function deletePresentationFromList(id) {
  if (!confirm('Delete this presentation?')) return;
  try {
    await fetch('/api/presentations/' + id, {method: 'DELETE'});
    await loadProjects();
    showToast('Deleted', 'success');
  } catch (e) {
    showToast('Delete failed', 'error');
  }
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  var diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

/* ═══════════════════════════════════════════════════════
   ACTION PILLS SYSTEM (Phase 3 Inline UI)
   ═══════════════════════════════════════════════════════ */
function initActionPills() {
  // Wire pill clicks
  document.querySelectorAll('.action-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const pillId = pill.dataset.pill;
      handlePillClick(pillId);
    });
  });

  // Wire sub-panel close buttons
  document.querySelectorAll('.subpanel-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kind = btn.dataset.close;
      const subpanel = $('subpanel-' + kind);
      if (subpanel) {
        subpanel.classList.remove('open');
        subpanel.setAttribute('aria-hidden', 'true');
      }
      $('pill-' + kind)?.classList.remove('active');
    });
  });

  // Wire sub-option cards with prompts
  document.querySelectorAll('.subopt-card[data-prompt]').forEach(card => {
    card.addEventListener('click', () => {
      const promptText = card.dataset.prompt;
      fillComposerPrompt(promptText);
      
      // Close containing subpanel
      const parentPanel = card.closest('.pill-subpanel');
      if (parentPanel) {
        parentPanel.classList.remove('open');
        parentPanel.setAttribute('aria-hidden', 'true');
      }
      document.querySelectorAll('.action-pill').forEach(p => p.classList.remove('active'));
    });
  });

  // Wire slide sub-option cards to open slide builder accordion
  document.querySelectorAll('.subopt-card[data-open-sb]').forEach(card => {
    card.addEventListener('click', () => {
      const topic = card.dataset.openSb;
      handleSlideCardClick(topic);
    });
  });

  // Wire more dropdown items
  document.querySelectorAll('.pill-more-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      let promptText = '';
      switch (action) {
        case 'video':
          promptText = 'Create a short video script and storyboard for: ';
          break;
        case 'scheduled':
          promptText = 'Schedule a task to run automatically every day at 9 AM: ';
          break;
        case 'research':
          promptText = 'Conduct a wide research project and compile references for: ';
          break;
        case 'spreadsheet':
          promptText = 'Create a spreadsheet template with formulas and sample data for: ';
          break;
        case 'viz':
          promptText = 'Generate a data visualization chart from this dataset: ';
          break;
        case 'audio':
          promptText = 'Generate or analyze audio transcript for: ';
          break;
        case 'chatmode':
          promptText = 'Let\'s chat about: ';
          break;
        case 'automation':
          promptText = 'Build an integration workflow to sync data between: ';
          break;
      }
      fillComposerPrompt(promptText);
      
      // Close more menu
      const menu = $('pill-more-menu');
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      $('pill-more')?.classList.remove('open');
    });
  });

  // Close menus/subpanels on document click (but NOT inside the SF modal)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-pill') && !e.target.closest('.pill-subpanel') && !e.target.closest('.pill-more-menu') && !e.target.closest('.sb-accordion')) {
      // Hide all subpanels
      document.querySelectorAll('.pill-subpanel').forEach(p => {
        p.classList.remove('open');
        p.setAttribute('aria-hidden', 'true');
      });
      // Deactivate pills
      document.querySelectorAll('.action-pill').forEach(p => p.classList.remove('active'));
      // Hide more menu
      const menu = $('pill-more-menu');
      if (menu) {
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
      }
      $('pill-more')?.classList.remove('open');
    }

  });
}

function handlePillClick(pillId) {
  // Hide other subpanels
  document.querySelectorAll('.pill-subpanel').forEach(p => {
    if (p.id !== 'subpanel-' + pillId) {
      p.classList.remove('open');
      p.setAttribute('aria-hidden', 'true');
    }
  });

  // Deactivate all pills except clicked
  document.querySelectorAll('.action-pill').forEach(p => {
    if (p.dataset.pill !== pillId) p.classList.remove('active');
  });

  // Special case: slides pill opens the inline accordion
  if (pillId === 'slides') {
    // Close any open subpanels first
    document.querySelectorAll('.pill-subpanel').forEach(function(p) {
      p.classList.remove('open');
      p.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.action-pill').forEach(function(p) { p.classList.remove('active'); });
    openSlideBuilder();
    return;
  }

  if (pillId === 'more') {
    const menu = $('pill-more-menu');
    const pill = $('pill-more');
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      pill.classList.remove('open');
    } else {
      menu.classList.add('open');
      menu.setAttribute('aria-hidden', 'false');
      pill.classList.add('open');
    }
    closeSlideBuilder();
    return;
  } else {
    const menu = $('pill-more-menu');
    if (menu) {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
    }
    $('pill-more')?.classList.remove('open');
  }

  const subpanel = $('subpanel-' + pillId);
  const pillBtn = $('pill-' + pillId);
  if (!subpanel) return;

  const isOpen = subpanel.classList.contains('open');
  if (isOpen) {
    subpanel.classList.remove('open');
    subpanel.setAttribute('aria-hidden', 'true');
    pillBtn?.classList.remove('active');
  } else {
    subpanel.classList.add('open');
    subpanel.setAttribute('aria-hidden', 'false');
    pillBtn?.classList.add('active');
    closeSlideBuilder();
  }
}

function handleSlideCardClick(topic) {
  openSlideBuilder(null, topic);
}

function fillComposerPrompt(text) {
  const input = $('message-input');
  if (input) {
    input.value = text;
    autoResizeTextarea();
    input.focus();
    // Scroll cursor to end of text
    input.setSelectionRange(text.length, text.length);
  }
}

function renderWelcomeProjects() {
  const panel = $('welcome-projects');
  const list = $('welcome-projects-list');
  if (!panel || !list) return;
  if (!projectsCache || !projectsCache.length) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  // Render up to 3 newest projects
  list.innerHTML = projectsCache.slice(0, 3).map(function(p) {
    var ago = p.created_at ? timeAgo(p.created_at) : '';
    return '<div class="welcome-project-card" onclick="openSlidesPreview(' + p.id + ', \'' + escapeHtml(JSON.stringify(p.slides || [])).replace(/'/g, "\\'") + '\')">' +
      '<span class="welcome-project-card-icon">📊</span>' +
      '<div class="welcome-project-card-title">' + escapeHtml(p.title || p.topic) + '</div>' +
      '<div class="welcome-project-card-meta">' + escapeHtml(p.template) + ' &middot; ' + p.slide_count + ' slides &middot; ' + ago + '</div>' +
    '</div>';
  }).join('');
}



/* Billing UI */
async function loadBillingStatus() {
  try {
    const res = await fetch('/api/billing/status');
    if (!res.ok) return null;
    const billing = await res.json();
    updateBillingBadge(billing);
    return billing;
  } catch (e) {
    return null;
  }
}

function updateBillingBadge(billing) {
  const badge = $('billing-badge');
  const label = $('billing-plan-label');
  if (!badge || !billing) return;
  const plan = billing.plan || 'Free';
  if (label) label.textContent = plan + ' plan';
  badge.classList.toggle('limit-reached', !!billing.limit_reached);
}

function openBillingSettings() {
  openModal('settings-modal');
  activateSettingsTab('billing');
  loadBillingStatus();
  if (window.OmniSettings && typeof window.OmniSettings.loadBilling === 'function') window.OmniSettings.loadBilling();
}

function showLimitExceededWarning(billing) {
  $('welcome-screen')?.classList.add('hidden');
  $('messages-container')?.classList.remove('hidden');
  const used = billing?.message_count ?? 0;
  const limit = billing?.message_limit ?? 'your';
  appendMessage('assistant', `<div class="limit-warning-card"><strong>Free plan limit reached</strong><p>You have used ${used} of ${limit} monthly messages. Upgrade to continue chatting.</p><button class="st-save-btn" type="button" onclick="openBillingSettings()">Upgrade plan</button></div>`);
}


