(function UchatClass(win, doc, UNDEF) {
	"use strict";
	if(win.Uchat) return;
	var server_name = 'main';
	var isDev = indexOf(['dev.uchat.io', 'dev.uchat.ch'], doc.domain) != -1?true:false;
	var domain = {
		web:'uchat.io'
		, client:'client.uchat.io'
		, server: [['kr-a-worker1.uchat.io', [5050, 8080], ''], ['kr-a-worker2.uchat.io', [5050, 8080], '']]
		, status:'status.uchat.io'
	};
	var onlySSL = false;
	onlySSL = true;
	domain['server'] = [['sp-worker.uchat.io', [0], '']];

	if(isDev) {
		domain = { web:'dev.uchat.io', client:'devclient.uchat.io', server: 'dev.uchat.io', status:'devstatus.uchat.io' };
		domain['server'] = [['dev.uchat.io', [5050, 8080], '']];
		server_name = 'dev';
	}

	var client_url = '';
	(function() {
		var jstags = doc.getElementsByTagName('script');
		var pattern = /\/uchat\.js/i;
		for(var i = 0, l = jstags.length; i < l; i++) {
			try{
				var url = jstags[i].getAttribute('src') || jstags[i].getAttribute('data-src');
				if(pattern.test(url)) {
					client_url = url;
					var inde_id = (/\/\/([^\.]+)\.1\.inde\.biz/i).exec(url)[1];
					if(inde_id) {
						server_name = 'inde-'+inde_id;
						domain.web = inde_id + '.inde.biz';
						domain.client = inde_id + '.1.inde.biz';
						domain.server = [[inde_id + '.2.inde.biz', [5050, 8080]]];
					}
				}
			} catch(e) {
				continue;
			}
		}
	})();

	var path = {
		'FLASHSOCKET_SWF_LOCATION' : '//'+domain.client+'/swf/socket.swf'//+randomString(7)
		, 'SKIN_LOCATION' : '//'+domain.client+'/skin/'
		, 'VIEW_LOCATION' : '//'+domain.client+'/skin/view.php'
		, 'LOAD_LOCATION' : '//'+domain.client+'/skin/load.php'
		//, 'SERVER_LIST' : '//'+domain.status+'/list.php'
		, 'SERVER_LIST' : '//'+domain.client+'/server.php'
		, 'PLUGIN': '//'+domain.client+'/plugin'
	}
		, setting = {
			heartbeat: 60
		}
		, debug = false 
		, mobiledebug = true
		, constant = {
			MODE_BASIC : 0
			, MODE_INDI : 1
			, MODE_INN : 2
			, MODE_CHILD : 3
			, MODE_CHANNEL : 4

			, AUTH_SERVER : 4
			, AUTH_ADMIN : 3
			, AUTH_SUBADMIN : 2
			, AUTH_MEMBER : 1
			, AUTH_GUEST : 0
		}
		, time_interval = 0;
	window.uchat_set_debug = function(val) {
		debug = val;
	};
	var logs = '';

	var wcs = (function() {
		//jsLoad('//wcs.naver.net/wcslog.js');
		//window.wcs_add=window.wcs_add||{}; wcs_add["wa"] = "ea4c797fffcdf";
		//wcs_do();
		var a = doc.createElement('script');
		a.src = '//wcs.naver.net/wcslog.js';
		a.onload = function() {
			window.wcs_add=window.wcs_add||{}; 
			window.wcs_add["wa"] = "ea4c797fffcdf";
			window.wcs_do();
			setTimeout(function() {
				window.wcs_do();
			}, 60*5*1000);
		};
		var b = doc.getElementsByTagName('script')[0];
		b.parentNode.insertBefore(a,b);
	})();
	var query = getQueryParams(document.location.search)
		, rooms = {}
		, sockets = {}
		, cache = (win.Uchat_cache = win.Uchat_cache || {'plugin':[], 'plugin_settings':{}})
		, server_list = undefined
		, server = domain.server[Math.floor(Math.random() * domain.server.length)]
		, ua = function() {
			var userAgent = navigator.userAgent.toLowerCase()
				, charset = ((doc.charset || doc.characterSet) == 'unicode'? 'utf-8' : (doc.charset || doc.characterSet)).toLowerCase()
				, ie = (function() {
				    var userAgent_str = window.navigator.userAgent;

				    var msie = userAgent_str.indexOf('MSIE ');
				    if (msie > 0) {
				        // IE 10 or older => return version number
				        return parseInt(userAgent_str.substring(msie + 5, userAgent_str.indexOf('.', msie)), 10);
				    }

				    var trident = userAgent_str.indexOf('Trident/');
				    if (trident > 0) {
				        // IE 11 => return version number
				        var rv = userAgent_str.indexOf('rv:');
				        return parseInt(userAgent_str.substring(rv + 3, userAgent_str.indexOf('.', rv)), 10);
				    }

				    var edge = userAgent_str.indexOf('Edge/');
				    if (edge > 0) {
				       	// Edge (IE 12+) => return version number
				       	return parseInt(userAgent_str.substring(edge + 5, userAgent_str.indexOf('.', edge)), 10);
				    }

				    // other browser
				    return false;

				})()
				, android = userAgent.indexOf("android") > -1
				, ios = /(ipad|iphone|ipod)/g.test( userAgent )
				, mobile = android || ios
				, webkit = /webkit/.test(userAgent) ? parseFloat(userAgent.replace(/^.*webkit\/(\d+(\.\d+)?).*$/, "$1")) : false;
			return {
				userAgent: userAgent
				, charset: charset
				, ie: ie
				, android: android
				, ios: ios
				, mobile: mobile
				, webkit: webkit
			}
		}()
		, roomFunctionCode = {
			0: 'ad',
			1: 'io',
			2: 'frozen',
			3: 'message',
			4: 'call',
			5: 'whisper',
			6: 'individual',
			7: 'font',
			8: 'call_admin',
			9: 'userLinkage'
		}
		, systemCode = {
			0: 'connected',
			1: 'ban',
			2: 'system_ban',
			3: 'apply_report',
			4: 'mute',
			5: 'un_mute',
			6: 'system_un_mute',
			7: 'to_call',
			8: 'from_call',
			9: 'ip',
			10: 'invite',
			11: 'ignore',
			12: 'notice',
			13: 'system_mute',
			14: 'muted',
			15: 'invite_notice',
			16: 'report_ban',
			17: 'bad_word',
			18: 'un_ignore',
			19: 'change_option',
			20: 'notify',
			21: 'frozen',
			22: 'defrozen',
			23: 'admin_join',
			24: 'admin_out',
			25: 'block_info',
			26: 'changed_info',
			27: 'op',
			28: 'deop',
			29: 'login',
			30: 'logout',
			31: 'channel_made',
			32: 'clear_log',
			33: 'too_many',
			34: 'admin_login',
			35: 'admin_logout',
			36: 'user_info',
			37: 'permanent_mute',
			38: 'permanent_muted',
			39: 'system_notice',
			40: 'toplayer',
			41: 'call_admin'
		}
		, language = {
			'kr': {
				system: {
					connected : '채팅서버에 연결 완료'
					, ban:'{1}님은 차단되었습니다. by. {0} (사유: {2})'
					, system_ban : '{0}님은 규정위반으로 자동 차단 되었습니다.'
					, report_ban : '{0}님은 신고누적으로 자동 차단 되었습니다.'
					, apply_report : '신고가 접수되었습니다.'
					, mute : '{1}님이 채팅금지가 되었습니다. by. {0} ({2}분)'
					, system_mute : '{0}님이 도배로 인해 채팅금지가 되었습니다.({1}분)'
					, un_mute : '{1}님의 채팅금지을 해제되었습니다. by. {0}'


					, system_un_mute : '{0}님의 채팅금지가 해제되었습니다.'
					, to_call : '{1}님을 호출하였습니다.'
					, from_call :'{0}님이 호출하였습니다.'
					, ip : '{0} 의 아이피 : {1}'
					, invite : '{0}님이 초대하였습니다. : <a href="#" class="invite_ok" onclick="room.action.command(\'individual\', \'{2}\'); return false;">승낙</a>'
					, invite_notice : '{1}님을 초대하였습니다.'
					, ignore : '이제부터 {0}님을 무시합니다.'
					, apply_option : '설정이 저장되었습니다.'
					, clear_log : '채팅방 청소(by. {0})'
					, notice : '{0}'

					, muted : '현재 채팅금지상태입니다.(약 {0}분 남음)'

					, bad_word : '{0}은(는) 금지어입니다.'

					, un_ignore : '이제 {0}님의 대화를 받기 시작합니다.'
					, change_option : '채팅방 설정이 변경되었습니다.'
					, frozen : '채팅방이 얼었습니다.<br />이제 관리자만 대화할 수 있습니다.'
					, defrozen : '채팅방이 녹았습니다.<br />모두 대화가 가능합니다.'

					, admin_join : '관리자가 접속하였습니다.'
					, admin_out : '관리자가 퇴장하였습니다.'
					, block_info : '차단일자 : {0} / 사유 : {1} / 해제일 : {2}'
					, changed_info : '정보가 변경되었습니다.'

					, changed_nick : "'{0}' 님이 '{1}'로 닉네임을 변경하였습니다."
					, op : '{1}님이 부관리자가 되었습니다.(by. {0})'
					, deop : '{1}님이 부관리자에서 해임되었습니다.(by. {0})'
					, login : '로그인 하였습니다.'
					, logout : '로그아웃 하였습니다.'

					, channel_made : '채널 채팅방을 생성하셨습니다. <br>관리 메뉴를 클릭하여 채팅방 비밀번호를 설정해주세요.'

					, too_many : '채팅방에 인원이 너무 많아 접속인원목록을 열면 브라우저가 멈출 수 있습니다.정말 여시겠습니까?'

					, admin_login : '{0}님이 관리자로 로그인하였습니다.'
					, admin_logout : '로그아웃하였습니다.'

					, user_info: '<b>닉네임:</b> {0}<br><b>아이디:</b> {1}<br><b>레벨:</b> {2}<br><b>권한:</b> {3}<br><b>접속시간:</b> {4}<br><b>고유세션:</b> {5}<br>'

					, permanent_mute: '{0}님이 영구채팅금지가 되었습니다.'
					, permanent_muted: '현재 영구적인 채팅금지입니다.'

					, system_notice: '{0}'
					, toplayer: '{0}'
					, call_admin: '관리자를 호출 하였습니다.'
				}
				, error: {
					0 : '알 수 없는 오류'
					, 101 : '프로토콜 오류'
					, 102 : '채팅방 아이디 누락'
					, 103 : '싱크를 맞출 수 없습니다.'
					, 104 : '싱크가 설정되어있지 않은 채팅방입니다.'
					, 105 : '데이터 길이가 너무 깁니다.'
					, 106 : '클라이언트 토큰 오류입니다.'

					, 201 : '존재하지 않는 채팅방입니다.'
					, 202 : '토큰변경이 된듯합니다. 다시 로그인해주세요!'
					, 203 : '토큰이 누락되었습니다.'
					, 204 : '알수없는 인코딩입니다.'
					, 205 : '페이지를 새로고침해주셔야됩니다. <br>* 새로고침해도 안되는경우, 유챗관리자에서 회원연동에 들어가신다음, "시간연동초기화" 버튼을 눌러보세요.'
					, 206 : '이미 개설되어 있는 채팅방입니다.'
					, 207 : '이용자가 가득 찬 채팅입니다.'
					, 208 : '잘못된 비밀번호입니다.'
					, 209 : '사용자의 정보를 읽어오지 못했습니다.'
					, 210 : '차단된 채팅방입니다.'

					, 301 : '이미 있는 닉네임입니다.'
					, 302 : '이미 접속중입니다.'
					, 303 : '고정된 다른 채팅방이 존재합니다.'
					, 304 : '이미 채팅방을 개설하였습니다.'
					, 305 : '접속권한이 없습니다.'

					, 401 : '데이터가 너무 깁니다.'
					, 402 : '권한이 없습니다.'
					, 403 : '존재하지 않는 명령어입니다.'
					, 404 : '대상이 존재하지 않습니다.'
					, 405 : '다른곳에서 접속하였습니다.'
					, 406 : '다른곳의 접속을 종료하였습니다.'
					, 407 : '이 명령어를 자신에게 사용할 수 없습니다.'
					, 408 : '강제퇴장당한 방에는 접속할 수 없습니다.'
					, 409 : '대상이 관리자입니다.'
					, 410 : '채팅권한이 없습니다.'
					, 411 : '한번만 가능한 명령어입니다.'
					, 412 : '명령어 값이 잘못되었습니다.'
					, 413 : '현재 채팅금지입니다.'
					, 414 : '대상은 현재 거부 상태 입니다.'
					, 415 : '현재 차단된 상태입니다.'
					, 416 : '이 채팅방에서는 실행할 수 없는 명령어입니다.'
					, 417 : '친구만 가능합니다.'
					, 418 : '얼어있는 채팅방입니다.'
					, 419 : '채팅방이 파괴되었습니다.'
					, 420 : '대상은 부관리자가 아닙니다.'
					, 421 : '이미 부관리자 입니다.'
					, 422 : '패스워드가 잘못되었습니다.'
					, 423 : '대상은 벙어리가 아닙니다.'
					, 424 : '수신거부상태에서는 사용할 수 없습니다.'
					, 425 : '너무 자주 사용할 수 없는 명령어 입니다.'
					, 426 : '대상은 이미 벙어리입니다.'
					, 427 : '자신과 같거나 높은 권한의 유저한테는 사용할 수 없습니다.'
					, 428 : '너무 많은 플러그인소통이 이루워지고 있습니다.'
					, 429 : '너무 많은 로그인시도가 이루워지고 있습니다. 잠시 후 이용해주세요.'
					, 430 : '같은 내용을 너무 많이 치고 있습니다.'

					, 501 : '존재하지 않는 개인채널 (새로고침을 요함)'
					, 502 : '개인채널에서는 개인채널을 만들 수 없습니다.'

					, 601 : '채팅방 설정이 변경되었습니다.'

					, 701 : '접속 비밀번호가 필요합니다. (또는 관리자 비밀번호)'

				}
			}
		}
		, protocol_list = ['webSocket', 'longPolling', 'flashSocket',  'fail']
		, protocols = {
			fail: function(socket) {
				this.socket = socket;
				this.name = 'fail';
				this.isAble = function() {
					return true;
				}
				this.init = function () {

				}

				this.install = function () {

				}

				this.ready = function ( ) {
					return true;
				}

				this.connected = function() {
					return false;
				}

				this.packet_send = function ( msg ) {

				}

				this.connect = function (server) {
				}

				this.disconnect = function(reason) {
				}
				this.onDisconnect = function() {
				}

			}
			, flashSocket: function(socket) {
				this.socket = socket;
				this.isAble = function() {
					try {
						if(new ActiveXObject('ShockwaveFlash.ShockwaveFlash'))
							return true;
					} catch(e) {
						var type = 'application/x-shockwave-flash';
						var mimeTypes = navigator.mimeTypes;
						if(mimeTypes && mimeTypes[type] && mimeTypes[type].enabledPlugin && mimeTypes[type].enabledPlugin.description)
							return true;
					}
					return false;
				}

				var flash, init=false, id = randomString(7), $this = this, host, port;
				this.name = 'flashSocket';

				this.init = function () {
				}

				this.install = function () {
					window.onbeforeunload = this.socket.disconnect;
					onLoad(installFlash);
				}

				this.ready = function ( ) {
					return !!(init && flash);
				}

				this.connected = function() {
					return flash && flash.connected && flash.connected();
				}

				this.packet_send = function ( msg ) {
					flash && flash.sendMsg( escape( msg ));
				}

				this.connect = function (server) {
					host = server[0];
					port = server[1];
					setTimeout(function() {
						flash = doc.getElementById('UchatFlash_'+id);
						flash && flash.connect(host, port);
					});
				}

				this.disconnect = function(reason) {
					try {
						flash && flash.disconnect();
					} catch(e) {
					}
					if(doc.getElementById('UchatFlash_'+id))
						doc.getElementById('UchatFlash_'+id).parentNode.removeChild(doc.getElementById('UchatFlash_'+id));
				}
				this.onDisconnect = function() {
				}

				function installFlash( ) {
					if(doc.getElementById('UchatFlash_'+id))
						doc.getElementById('UchatFlash_'+id).parentNode.removeChild(doc.getElementById('UchatFlash_'+id));

					var data = 'id='+id;

					//var b=doc.scripts;
					var b=doc.body;
					//var b=self.room.iframe;
					//log(b);
					var flashs = doc.createElement('object');
					if(typeof ActiveXObject != 'undefined')
						flashs.setAttribute('classid', 'clsid:D27CDB6E-AE6D-11cf-96B8-444553540000');
					else
						flashs.setAttribute('type', 'application/x-shockwave-flash');
					flashs.setAttribute('id', 'UchatFlash_'+id);
					flashs.setAttribute('width', '1');
					flashs.setAttribute('height', '1');
					flashs.setAttribute('wmode', 'transparent');
					flashs.style.marginTop = '-1px';

					var params = [];

					params.push(doc.createElement('param'));
					params[params.length-1].setAttribute('name', 'Movie');
					params[params.length-1].setAttribute('value', path['FLASHSOCKET_SWF_LOCATION']+'?_'+randomString(22));

					params.push(doc.createElement('param'));
					params[params.length-1].setAttribute('name', 'Src');
					params[params.length-1].setAttribute('value', path['FLASHSOCKET_SWF_LOCATION']+'?_'+randomString(22));

					params.push(doc.createElement('param'));
					params[params.length-1].setAttribute('name', 'flashvars');
					params[params.length-1].setAttribute('value', data);

					params.push(doc.createElement('param'));
					params[params.length-1].setAttribute('name', 'allowScriptAccess');
					params[params.length-1].setAttribute('value', 'always');

					params.push(doc.createElement('param'));
					params[params.length-1].setAttribute('name', 'allowNetworking');
					params[params.length-1].setAttribute('value', 'all');
					/*
					params.push(doc.createElement('param'));
					params[params.length-1].setAttribute('name', 'swliveconnect');
					params[params.length-1].setAttribute('value', 'true');

					params.push(doc.createElement('param'));
					params[params.length-1].setAttribute('name', 'hasPriority');
					params[params.length-1].setAttribute('value', 'true');
					*/

					for(var i=0; i<params.length; i++)
						flashs.appendChild(params[i]);

					var div = doc.createElement('div');
					div.id = 'TempUchatDiv';
					//b[b.length-1].parentNode.appendChild(div);
					b.appendChild(div);
					//b.parentNode.appendChild(div);
					win['flashSocket_'+id] = function() { $this.socket.onData.apply($this.socket, arguments) };
					//log($this);
					div.outerHTML = flashs.outerHTML;

				}
			}
			, webSocket: function(socket) {
				this.socket = socket;
				this.type = 'byte';
				this.isAble = function() {
					try{
						if("WebSocket" in win)
							if(ua.android)
								new WebSocket('ws:').close();
						else
							return true;
					} catch(e) {
						return true;
					}
					return false;
				}

				var websocket, host, port;
				this.name = 'websocket';

				this.init = function () {
				}
				this.install = function () {
					this.socket.onData("socketInit\n");
				}
				this.ready = function ( ) {
					return websocket && websocket.readyState == WebSocket.OPEN;
				}
				this.connected = function() {
					return websocket && websocket.readyState == WebSocket.OPEN;
				}
				this.packet_send = function ( msg ) {
        			var result = new Uint8Array(msg);
					websocket && websocket.readyState == WebSocket.OPEN && websocket.send(result.buffer);

        			return;
					var bytearray = new Uint8Array(msg.length);
					for(var i=0, l=msg.length; i<l; i++) {
						bytearray[i] = msg.charCodeAt(i);
					}
					websocket && websocket.readyState == WebSocket.OPEN && websocket.send(bytearray.buffer);
				}
				this.connect = function (server) {
					host = server[0];
					port = server[1];
					var $this = this;

					websocket = new WebSocket('ws'+(onlySSL?'s':(location.protocol === 'https:'?'s':''))+'://'+host+(port?':'+port:''));
					websocket.binaryType = 'arraybuffer';
					websocket.onopen = function() {
						$this.socket.onData('onConnect\n');
					};
					websocket.onmessage = function (evt) {
						var dataView = new DataView(evt.data);
						var es = [];

						for (var i = 0, len = dataView.byteLength; i < len; ++i) {
							es.push(dataView.getUint8(i));
						}
						$this.socket.onData(es);
					};
					websocket.onerror = function(e) {
						log('weboskcet onerror');
					}
					websocket.onclose = function(e) {
						log('websocket close code : '+ e.code);
						$this.socket.onData('onDisconnect\n');
					};
				}
				this.disconnect = function() {
					websocket && websocket.close();
				}

				this.onDisconnect = function() {

				}

			}
			, longPolling: function(socket) {
				this.socket = socket;
				this.isAble = function() {
					//Detect browser support for CORS
					if (typeof new XMLHttpRequest().withCredentials !== 'undefined') {
						return true;
					} else if(typeof XDomainRequest !== "undefined" && ua.ie > 7){
						return true;
					}
					return false;
				}

				this.name = 'longPolling';
				this.socket_connect = false;
				var $this = this
					, WAIT_GET = false
					, key = randomString(20)
					, host
					, port
					, post_host
					, post = false
					, buffer = []
					, need_buffer = !!window.XDomainRequest;

				this.init = function() {
				}

				this.install = function() {
					window.onbeforeunload = $this.socket.disconnect;
					this.socket.onData('socketInit\n');
				}

				this.ready = function() {
					return $this.socket_connect;
				}

				this.connected = function() {
					return $this.socket_connect;
				}

				this.packet_send = function( data ) {
					buffer.push(data);
					$this.flush();
				}
				this.flush = function() {
					var data = buffer.join('');
					if(data && !post) {
						buffer = [];
						post = ajax({
							'method': 'post',
							'url': '//'+host+':'+port+'/?key='+key+'&r='+(new Date().getTime())+randomString(5),
							'low_data': data
						}).fail(function() {
							post = false;
							$this.socket.onData('onDisconnect\n');
						}).done(function() {
							post = false;
							$this.flush();
						});
					}
				}
				this.connect = function (server) {
					host = server[0];
					port = server[1];
					post_host = server[2];
					onFullLoad(function() {
						GETPolling();
						setTimeout(function() {
							$this.socket_connect = true;
							$this.socket.onData('onConnect\n');
						});

					});
				}
				this.disconnect = function () {
					if(WAIT_GET)
						WAIT_GET.abort();
					if(post)
						post.abort();
					ajax({
						'method': 'post',
						'url': '//'+host+':'+port+'/?key='+key+'&r='+(new Date().getTime())+randomString(5),
						'low_data': 'disconnect\n',
						'async': false
					});
					this.socket_connect = false;
				}

				this.onDisconnect = function() {
					if(WAIT_GET)
						WAIT_GET.abort();
					$this.socket_connect = false;
				}

				var CP1252EXTRAS= '\u20ac\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u0152\u017d\u017d\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u0153\u017e\u0178';
				function getCodePage1252Byte(s) {
    				var ix= CP1252EXTRAS.indexOf(s);
    				if (ix!==-1)
        				return 128+ix;
        			return s.charCodeAt();
				}

				function GETPolling () {
					WAIT_GET = ajax('//'+host+':'+port+'/?key='+key+'&r='+(new Date().getTime())+randomString(5)+(need_buffer?'&need_buffer=1':'')).progress(function( data ) {
						var result = [];
						for(var i =0, l=data.length; i<l; i++) {
							result.push(getCodePage1252Byte(data[i]) & 0xff);
						}
						$this.socket.onData(result);	
					}).always(function( data ) {
						$this.socket.onData('onDisconnect\n'); // ie 에서는 reponse이있으면 무조건 ok 라서
					});
				}

			}
		}
		, splitExec = (function (undef) {
			if(ua.ie && ua.ie > 7) return false;
			var nativeSplit = String.prototype.split,
				compliantExecNpcg = /()??/.exec("")[1] === undef, // NPCG: nonparticipating capturing group
				self;

			self = function (str, separator, limit) {
				// If `separator` is not a regex, use `nativeSplit`
				if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
					return nativeSplit.call(str, separator, limit);
				}
				var output = [],
					flags = (separator.ignoreCase ? "i" : "") +
					(separator.multiline  ? "m" : "") +
					(separator.extended   ? "x" : "") + // Proposed for ES6
					(separator.sticky	 ? "y" : ""), // Firefox 3+
					lastLastIndex = 0,
					// Make `global` and avoid `lastIndex` issues by working with a copy
					separator = new RegExp(separator.source, flags + "g"),
					separator2, match, lastIndex, lastLength;
				str += ""; // Type-convert
				if (!compliantExecNpcg) {
					// Doesn't need flags gy, but they don't hurt
					separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
				}
				/* Values for `limit`, per the spec:
				 * If undefined: 4294967295 // Math.pow(2, 32) - 1
				 * If 0, Infinity, or NaN: 0
				 * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
				 * If negative number: 4294967296 - Math.floor(Math.abs(limit))
				 * If other: Type-convert, then use the above rules
				 */
				limit = limit === undef ?
					-1 >>> 0 : // Math.pow(2, 32) - 1
					limit >>> 0; // ToUint32(limit)
				while (match = separator.exec(str)) {
					// `separator.lastIndex` is not reliable cross-browser
					lastIndex = match.index + match[0].length;
					if (lastIndex > lastLastIndex) {
						output.push(str.slice(lastLastIndex, match.index));
						// Fix browsers whose `exec` methods don't consistently return `undefined` for
						// nonparticipating capturing groups
						if (!compliantExecNpcg && match.length > 1) {
							match[0].replace(separator2, function () {
								for (var i = 1; i < arguments.length - 2; i++) {
									if (arguments[i] === undef) {
										match[i] = undef;
									}
								}
							});
						}
						if (match.length > 1 && match.index < str.length) {
							Array.prototype.push.apply(output, match.slice(1));
						}
						lastLength = match[0].length;
						lastLastIndex = lastIndex;
						if (output.length >= limit) {
							break;
						}
					}
					if (separator.lastIndex === match.index) {
						separator.lastIndex++; // Avoid an infinite loop
					}
				}
				if (lastLastIndex === str.length) {
					if (lastLength || !separator.test("")) {
						output.push("");
					}
				} else {
					output.push(str.slice(lastLastIndex));
				}
				return output.length > limit ? output.slice(0, limit) : output;
			};

			// For convenience
			String.prototype.split = function (separator, limit) {
				return self(this, separator, limit);
			};

			return self;

		})()
		, session = ''/*= (function() {
			if(!getCookie('uchat_session'))
				setCookie("uchat_session", randomString(32), 365);
			return getCookie('uchat_session')
		})()*/
		, room_nicknames = {}
		, room_settings_expiry = {}
		, room_settings = (function room_settings_function(count) {
			var result = {};
			var cookie = getCookie("UCHAT_SETTINGS");
			if(count > 5) {
				session = randomString(32);
				return result;
			}
			cookie = unescape(cookie);
			var floor = cookie.split('\n');
			session = floor.shift();
			if(!cookie || !session || session.length != 32) {
				session = randomString(32);
				save_room_settings();
				return room_settings_function(++count);
			}
			for(var i=0; i<floor.length; i++) {
				var tmp = floor[i].split(' ');
				if(tmp.length != 4) continue;
				var room_id = tmp.shift();
				var session_time = tmp.shift();
				var nickname = tmp.shift();
				var setting = JSONParse(tmp.join(' '));
				if(parseInt(new Date().getTime()/1000) < parseInt(session_time)) {
					room_nicknames[room_id] = nickname || '';
					room_settings_expiry[room_id] = session_time*1;
					result[room_id] = setting;
				}
			}
			return result;
		})(0)
		, _forElement = doc.createElement('U-Chat')
		, _api = (function(U) {
			U.chat = function(n) {
				if(n == '*' || !rooms[n]) {
					return {
						on : function(e, t) {
							U.events.push([n,e,t]);
							if(parsing_event_name(e)[0] == 'after.create') {
								if ( n == '*') {
									for(var i in rooms) {
										if(rooms[i] && rooms[i].skin_ready) {
											t(rooms[i].skin_adapter, {id : i});
										}
									}
								} else if( rooms[n] && rooms[n].skin_ready) {
									t(rooms[n].skin_adapter, {id : n});
								}
							}
						},
						off : function(e) {
							var v = parsing_event_name(e);
							for(var t=U.events.length;t>0;) {
								var pe = parsing_event_name(U.events[--t][1]);
								if((U.events[t][0] == n || n == '*')
									&& ((U.events[t][1] == e)
										|| (pe[1] && v[1]  && pe[1] == v[1])
										|| (pe[0] && v[0]  && pe[0] == v[0])))
								 	U.events.splice(t,1);
							}
						}
					}
				} else { 
					if(rooms[n] && rooms[n].skin_adapter) {
						return rooms[n].skin_adapter;
					}
				}
			}
		})((win.U = win.U || {}))
		, api = win.U.events = win.U.events || []
		, event_name_cache = {};
	(function() {
		return false; // 180401 uk 임시조치
		jsLoad(path.SERVER_LIST, 'server', function(data) {
			server_list = data;
			for(var i in rooms) {
				rooms[i].readyConnect();
			}
		});
	})();
	function parsing_event_name(name) { 
		var arr = name.split('#');

		return arr;

	}
	function hook(room, event, data, filter) {
		var result = true;
		for(var i=0, l=api.length; i<l; i++) {
			if(!api[i][2]) continue;
			if(api[i][0] == '*' || api[i][0] == room.id) {
				if(!event_name_cache[api[i][1]]) {
					event_name_cache[api[i][1]] = parsing_event_name(api[i][1]);
				}
				if(event_name_cache[api[i][1]][0] == event) {
					try {
						if(api[i][2](room.skin_adapter, data) === false) {
							result = false;
							break;
						}
					} catch (e) {
						console.error('uchat API error('+room.id+', '+api[i][1]+')', e);
					}
				}
			}
		}
		return result;
	}
	function iframe(room, width, height) {
		var id = randomString(7);
		var live = true;
		var wrote = false;
		if(room.target_iframe) {
			var iframe = room.target_iframe;
		} else {

			var script = doc.scripts[doc.scripts.length-1];
			//var iframe = doc.createElement('iframe');
			var iframe_html = "<iframe id='iframe_"+id+"' frameBorder='0'></iframe>";
			//iframe_html += "<iframe src='//dev.uchat.io/t?joindata="+room.installData.user_data+"' style='width:0px; height:0px; border:0px; margin:0px; padding:0;'></iframe>";

			if(room.wrap) {
				room.wrap.innerHTML = iframe_html;
				width = height = '100%';
				room.installData.wrap = undefined;
			} else
				doc.write(iframe_html);

			var iframe = doc.getElementById('iframe_'+id);
		}
		iframe.removeAttribute('id');
		iframe.contentWindow.document.open();

		iframe.setAttribute('scrolling', 'no');
		iframe.setAttribute('frameBorder', 0);
		//iframe.setAttribute('width', width);
		//iframe.setAttribute('height', height);
		iframe.style.display = 'inline-block';
		if(width) {
			if(parseInt(width)+'' === width+'') width = width + 'px';
			iframe.style.width = width;
		}
		if(height) {
			if(parseInt(height)+'' === height+'') height = height + 'px';
			iframe.style.height = height;
		}

		var self = this;
		this.init = false;
		this.rooms = {};
		this.event = [];

		this.rooms[room.id] = room;
		this.created = false;
		var return_json = {
			init: function() {
				this.init = true;
			}
			, element: iframe
			, win: iframe.contentWindow
			, doc: iframe.contentWindow.document
			, adapter: {
				ua: ua
				, set: function() {
				}
				, ready: function(win) {/*
					return_json.win = win;
					return_json.doc = win.document;*/
					if(!live) return false;
					self.init = true;
					for(var i in self.rooms) {
						log(room.uuid, '방레디', id);
						var hook_data = {
							id : room.id
						};
						for(var j=0, l=self.event.length; j<l; j++ ) {
							if(self.event[j][0] == 'creation') {
								self.event[j][1](room.skin_adapter);
							}
						}
						hook(room, 'after.create', hook_data);
						self.rooms[i].on("skinInit");
						self.created = true;
					}
				}
				, on: function(type, fn) {
					if(!live) return false;
					self.event.push([type, fn]);
				}
				, getServerSecond : getServerSecond
			}
			, write: function(html) {
				if(!live) return false;
				if(wrote) return false;
				wrote = true;
				/*
				this.html = escape(html);
				iframe.contentWindow.contents = ('<script>var Uchat = parent.Uchat.room("'+room.id+'").iframe.adapter;<\/script>'+html);
				iframe.src = 'javascript:unescape(parent.Uchat.room("'+room.id+'").iframe.html);';
				*/
				setTimeout(function() {
					//html = html.replace('{head}', 'var Uchat = parent.Uchat.room("'+room.id+'").iframe.adapter;');
					//iframe.contentWindow.document.open(); // 엣지에서 메모리 에러가 뜨니 제거.
					extend(return_json.win, constant, {Uchat: return_json.adapter, JSONParse:JSONParse, JSONStringify:JSONStringify, indexOf: indexOf});
					log('iframe-write', html.length);
					return_json.doc.write(html);
					return_json.doc.close();
					setTimeout(function() { return_json.adapter.ready(); }, 4);
					log(id, '아이프레임 write');
				});


			}

		};

		iframe.onload = function(event) {
			try {
				var d = this.contentWindow.document
			} catch (e) {}
			if (d && (!d.body || !d.body.firstChild)) {
				//return_json = undefined;
				if(!live) return false;
				live = false;
				log(event);
				room.destory();
				room.reinstall();
			}
		}
		
		iframe.contentWindow.onunload = function(e) { // 채팅방이 사라졌으면 채팅방 접속이 끊겨야됨
			room.destory();
		};

		return return_json;
	}

	function room(installData, target_iframe) {
		if( this instanceof room == false ) {
			if(isJson(installData))
				return new room(installData);
			else if(isStr(installData))
				return rooms[installData] ? rooms[installData] : false;
		}
		this.installData = extend({}, installData);
		if(!this.installData.room)
			return ; // 채팅방 아이디가 지정되지 않음 에러.
		if(rooms[this.installData.room]) return;
		rooms[this.installData.room] = this;
		var id = this.installData.room;
		var self = this;

		this.id = this.installData.room;
		this.uuid = randomString(7);
		this.skin = 'basic';
		this.target_iframe = target_iframe;
		this.wrap = this.installData.wrap || undefined;
		this.iframe = new iframe(this, this.installData.width, this.installData.height);
		this.info = {};
		this.my = {};
		this.tempArr = {};
		this.users = [];
		this.event = [];
		this.key = {};
		this.user_data = {};
		this.nick = room_nicknames[this.id] || '';
		this.default_setting = {};
		//this.setting_expiry = room_settings_expiry[this.id.split('@')[0]] || ( room_settings_expiry[this.id.split('@')[0]] = parseInt(new Date().getTime()/1000)+(7*60*60*24) );
		this.setting = {};//room_settings[this.id.split('@')[0]] || (room_settings[this.id.split('@')[0]] = {});
		this.individual = undefined;
		this.server_location = undefined;
		this.server = undefined;
		this.readyConnected = false;
		this.plugin_setting = {};
		this.arguments = extend({}, (win['Uchat_argument'] || {}), (win['Uchat_argument_'+this.id] || {}));//win.Uchat_arguments[this.id] || {};//installData.skin_arguments?installData.skin_arguments:(installData.arguments?installData.arguments:{});
		if(isEmpty(this.arguments) || true) load(this.id, 'setting', '', function(data) {
			extend(self.arguments, data);
			if(self.arguments['skin'])
				self.skin = self.arguments['skin'];
			extend(self.plugin_setting, cache['plugin_settings'][self.id]||{});
			self.installPlugin();
			self.getSkin();
			self.server_location = data.server||'kr-1';
			self.readyConnect();
		});
		if(this.installData.room == 'test') debug = true;// 삭제할 부분
		this.skin_ready = false;
		this.socket_ready = false;
		this.joined = false;
		this.last_data = '';
		this.queue_stack = [];
		this.pluginList = {};
		this.init();
		if(!hook(self, 'before.create', {})) return false;
		return {
			foo: function() {
				log('foo');
				return this;
			}
			, bar: function() {
				log('bar');
				return this;
			}
		};
	};

	room.fn = room.prototype = {
		init: function() {
			this.socket = new socket(this);
			this.readyConnect();
			this.skin_adapter = new skin_adapter(this);
		}
		, readyConnect: function() {
			if(this.readyConnected) 
				return False;
			if(this.socket && this.socket.socket_init && server_list && this.server_location) {
				this.server = server_list[this.server_location][parseInt(Math.random()*server_list[this.server_location].length)];
				log(this.server);
				this.socket.connect(this.server);
			}
		}
		, queue: function( data ) { 

			if(data)
				this.queue_stack.push(data);
			for(var i = 0; i<this.queue_stack.length; i++ ) { 

				if(!this.skin_ready) break;
				if(!this.queue_stack[i]) continue;
				this.on(this.queue_stack[i].shift(), this.queue_stack[i]);

				delete this.queue_stack[i];

			}

		}
		, getSkin: function( data ) {
			var self = this;
			var kind = 'index';
			if(this.id.indexOf('@') != -1) {
				kind = 'index';
			} else if(this.id.indexOf('.') != -1) {
				kind = 'child';
			}
			viewLoad(this.skin, kind, function(layout) {
				self.layout = layout;

				var externalJsRegex = /{externalJs\|[^}]+}/g;
				var matches = self.layout.match(externalJsRegex);;
				var links = [];
				if(matches !== null) {
					for(var i in matches) {
						var match = (/{externalJs\|([^}]+)}/g).exec(''+matches[i]);
						if(match !== null) {
							if(links.indexOf(match[1]) != -1) continue;
							links.push(match[1]);
							(function(url) {
								var url_regex = new RegExp('{externalJs\\|'+url.replace(/[\[\\\^\$\.\|\?\*\+\(\)]/g, '\\$&')+'}', 'g');
								ajax({
									url: url
								}).done(function(html) {
									self.layout = self.layout.replace(url_regex, '<script>'+html+'<\/script>');
								}).fail(function() {
									self.layout = self.layout.replace(url_regex, '');
								}).always(function(html) {
									links.splice( links.indexOf(url), 1);
									if(!links.length)
										self.iframe.write(self.layout);
								});
							})(match[1]);
						}
					}
				} else {
					self.iframe.write(layout);
				}
			});
		}
		, destory: function() {
			this.socket && this.socket.destory();
			this.clearEvent();
			delete rooms[this.id];
		}
		, clearEvent : function ( ) { 
			var i = api.length;
			while( i -- ) {
				if(api[i][0] == this.id)
					api.splice(i, 1);
			}
		}
		, reinstall: function() {
			//log(this.id, 'reinstall', this.installData, this.iframe.element);
			new room(this.installData, this.iframe.element);
		}
		, test: function() {
			return this;
		}
		, join: function() {

		}
		, trigger: function(eventtype, data) {
			for(var i=0, l=this.event.length; i<l; i++) {
				if(this.event[i][0] == eventtype) {
					this.event[i][1](this.skin_adapter, data);
				}
			}
		}
		, commandList : {
			info : function ( data ) {
				if(!data[0])
					return this.on('error', [404]);
				this.socket.send(['command', 'info', data[0]]);
			},
			password : function(data) { // password
				if(!data[0])
					return this.on('error', [701]);
				this.installData.password = data[0];
				this.on('join');
			},
			ban : function(data) { // target
				if(this.my.nick == data[0])
					return this.on("error", [407]);
				if(this.my.auth < 2)
					return this.on("error", [402]);
				this.socket.send(['command', 'ban', data[0], data[1], data[2]?data[2]:0]);
			},
			whisper : function(data) { // target message
				if(!data[1])
					return false;
				if(this.my.nick == data[0])
					return this.on("error", [407]);
				if(this.setting && !this.setting['access.whisper']) {
					return this.on("error", [424]);
				}
				this.socket.send(['command', 'whisper', data[0], '', data[1]]);
			},
			report : function(data) { // target reason
				if(!data[0])
					return this.on("error", [404]);

				if(this.my.nick == data[0])
					return this.on("error", [407]);

				this.socket.send(['command', 'report', data[0], data[1]]);
			},
			upload : function(data) { // callback
				var self = this;
				this.upload_popup = window.open('', "", "width=320, height=190, scrollbars=no, resizable=no, location=no");
				viewLoad(this.skin, 'upload', function(html) {
					self.upload_popup.document.open();
					self.upload_popup.document.write(html);
					self.upload_popup.document.close();
					self.upload_popup.window.onImage = function(upload_data) {
						var upload_json = JSONParse(upload_data);
						if(data[0] && typeof data[0] == 'function') data[0](upload_json);
					}
				});
			},
			mute : function(data) { // target period reason
				if(!data[0])
					return this.on("error", [404]);

				if(this.my.auth < 2)
					return this.on("error", [402]);

				if(this.my.nick == data[0])
					return this.on("error", [407]);

				if(!data[2])
					data[2] = '';

				this.socket.send(['command', 'mute', data[0], data[1], data[2]]);
			},
			unmute : function(data) { // target 
				if(!data[0])
					return this.on("error", [404]);

				if(this.my.auth < 2)
					return this.on("error", [402]);

				this.socket.send(['command', 'unmute', data[0]]);
			},
			call : function(data) { // target
				if(!data[0])
					return this.on("error", [404]);
				this.socket.send(['command', 'call', data[0]]);
			},
			ip : function(data) { // target
				if(!data[0])
					return this.on("error", [404]);

				if(this.my.auth < 2)
					return this.on("error", [402]);

				this.socket.send(['command', 'ip', data[0]]);
			},
			ignore : function(data) { // target
				if(!data[0])
					return this.on("error", [404]);

				if(this.my.id == data[0])
					return this.on("error", [407]);
				var target_session = this.user_data[data[0]]['session'];
				this.setting.ignores = this.setting.ignores || [];
				if(indexOf(this.setting.ignores, target_session) == -1)
					this.setting.ignores.push(target_session);

				save_room_settings();
				this.on("system", [11, data[0]]);
			},
			un_ignore : function(data) { // target
				if(!data[0])
					return this.on("error", [404]);
				if(!this.setting.ignores || !isArray(this.setting.ignores))
					return false;
				var target_session = this.user_data[data[0]]['session'];
				for(var i=this.setting.ignores.length; i>=0; i--)
					if(this.setting.ignores[i] == target_session)
						this.setting.ignores.splice(i, 1);
				save_room_settings();
				this.on("system", [18, data[0]]);
			},
			popup : function(data) { // none
				/*
				   if(popup)
				   return;
				   */
				if(this.installData.mode == 'popup') {
					return false;
				}

				var html = '';
				html += '<!doctype html>';
				html += '<html lang="kr">';
				html += '<head>';
				html += '	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, target-densityDpi=medium-dpi" />';
				html += '	<meta http-equiv="X-UA-Compatible" content="IE=edge">';
				html += '	<meta charset="utf-8">';
				html += '	<style>';
				html += '		html, body {padding:0;margin:0;}';
				html += '		html, body{';
				html += '		font-size:0;overflow:hidden;line-height:0;height:100vh;';
				html += '			}';
				html += '		#wrap {height:100%;}';
				html += '		#wrap iframe {width:100%;font-size:0;overflow:hidden;line-height:0;}';
				html += '	</style>';
				html += '	<script type=\'text/javascript\' data-src="'+client_url+'">';
				html += '	(';
				html += UchatClass.toString();
				html += '	)(window, document, undefined);';
				html += '	<\/script>';
				html += '</head>';
				html += '<body>';
				html += '<div id="wrap">';
				html += '<script type=\'text/javascript\'>';
				var joinData = {room: this.id, mode:'popup', skin:this.installData.skin, width:'100%', height:Uchat.ua.ios?'100vh':'100%'};
				html += 'Uchat.room('+JSONStringify(joinData)+');';
				//html += 'document.write(\'<iframe id="UchatFrame_\'+(Uchat.length-1)+\'" frameBorder=0 scrolling="no"></iframe>\');';
				html += '<\/script>';
				html += '</div>';
				html += '</body>';
				html += '</html>';

				this.popup = window.open('', "", "width=400, height=600, scrollbars=no, resizable=yes, location=no");
				var self = this;
				setTimeout(function() {
					self.popup.document.open();
					self.popup.document.write(html);
					self.popup.document.close();
				});
				//this.socket.send(['command', 'popup']);
			},
			invite : function(data) { // target
				try {
					if(!this.individual || this.individual.closed) {
						this.skin_adapter.action.command('individual');
						if( data[0] != this.my.nick )
							this.invite_temp = escape(data[0]);
					} else {
						this.socket.send(['command', 'invite', data[0]]);
					}
				} catch(e) {
					this.skin_adapter.action.command('individual');
					this.invite_temp = escape(data[0]);
				}
			},
			individual : function(data) { // target
				this.individual = window.open('', "", "width=400, height=600, scrollbars=no, resizable=yes, location=no");
				this.socket.send(['command', 'individual', data[0]]);
			},
			noticeList : function(data) { // none
				this.socket.send(['command', 'noticeList']);
			},
			io : function(data) { // true or false
				if(data.length < 1)
					return false;
				this.socket.send(['command', 'io', data[0]?true:false]);
			},
			chatList : function(data) { // count
				if(!data[0])
					data[0] = 15;
				this.socket.send(['command', 'chatList', data[0]]);
			},
			userList : function(data) { // count search
				if(!data[0])
					data[0] = 10000;
				if(!data[1])
					data[1] = '';
				this.socket.send(['command', 'userList', data[0], data[1]]);
			},
			changeInfo : function(data) { // json {key: value}
				if(!data[0])
					return this.on("error", [101]);
				var data_arr = [];
				for(var i in data[0]) {
					data_arr.push(i);
					data_arr.push(data[0][i]);
				}
				this.socket.send(['command', 'changeInfo'].concat(data_arr));
			},
			notice : function(data) { // html ?
				if(!data[0])
					return this.on("error", [412]);

				if(this.my.auth < 2)
					return this.on("error", [402]);

				this.socket.send(['command', 'notice', data.join(' ')]);
			},
			clearlog : function(data) { // none
				if(this.my.auth < 2)
					this.on('control', ['clearLog']);
				else
					this.socket.send(['command', 'clearLog']);
			},
			op : function(data) { // target
				if(this.my.auth < 3)
					return this.on("error", [402]);
				this.socket.send(['command', 'op', data[0]]);
			},
			deop : function(data) { // target
				if(this.my.auth < 3)
					return this.on("error", [402]);
				this.socket.send(['command', 'deop', data[0]]);
			},
			login : function(data) { // password
				this.socket.send(['command', 'login', data[0]]);
			},
			adminPage : function(data) { // none
				if(this.my.auth < 3)
					return this.on("error", [402]);
				var popUrl = '//'+domain.web+"/manage/sessionLogin/"+encodeURIComponent(this.id)+"?chatSession="+session;	//팝업창에 출력될 페이지 URL
				var popOption = "width=993, height=600, resizable=no, scrollbars=yes, status=no;";	//팝업창 옵션(optoin)
				window.open(popUrl,"",popOption);
			}
		}
		, goJoin: function(data) {
			if(this.installData.mode == 'popup') {
				data.other = (data.other || '');
				var other = data.other.split(' ');
				if(other.indexOf('popup') == -1)
					other.push('popup');
				data.other = other.join(' ');
			}
			this.socket.send(['j', this.id, data.nick, data.id, data.level, (data.auth||''), data.icons, data.nickcon, data.other, data.hash, session, ua.charset, data.time, this.installData.password, cache['client_token'], data.profileimg]);
		}
		, parseDATA: function(data) {
			var userData = dataParse(data);
			log(this.uuid, '다듬어짐', userData);
			var hook_data = {'user':userData};
			if(!hook(this, 'before.join', hook_data)) return false;
			return hook_data.user;
		}

		, on: function(eventtype, data) {
			log(this.uuid, eventtype, data);
			if(!this.event) {
				log(this.id, '없는 이벤트로 들어온 데이터', eventtype, data);
				return false;
			}
			switch( eventtype ) {

				case 'externalEvent':
					var hook_data = { 'type': 'click' };
					hook(this, 'before.externalEvent', hook_data);
					this.trigger( 'externalEvent', hook_data);
					hook(this, 'after.externalEvent', hook_data);
					break;
				case 'plugin':
					var sender = this.key[data.shift()];
					var type = data.shift();
					var channel = data.shift();
					var hook_data = {
						user : copy(sender),
						type : type,
						data : data
					}
					if(hook(this, 'before.plugin', hook_data) === false) return false;
					if(this.pluginList[channel] && this.pluginList[channel].receiver) {
						for(var i=0, l=this.pluginList[channel].receiver.length; i<l;i++) {
							this.pluginList[channel].receiver[i](this.skin_adapter, hook_data);
						}
					}
					hook(this, 'after.plugin', hook_data);
					break;
				case 'skinInit':
					//log('start');
					log(this.uuid, "room.on.skinInit");
					//room.socket.frameRoaded = true;
					//room.socket.start('onskin');
					if(!this.skin_ready) {
						this.skin_ready = true;
						this.queue();
						//this.iframe_win.Uchat && this.iframe_win.Uchat.creation(this.skin_adapter);
					}
					if(this.socket && this.socket.isConnect()) {
						this.on("join");
					}
					break;

				case 'socketInit':
					log(this.uuid, "room.on.socket.init");
					if(this.skin_ready)
						this.on("join");
					break
				case 'key':
					var user = {
						'nick':data[1]
						, 'id':data[2]
						, 'level':data[3]
						, 'auth':data[4]
						, 'icons':data[5]
						, 'nickcon':data[6]
						, 'connected':getTimeStamp(data[7])
						, 'time': data[7]
						, 'mute':data[8]&1
						, 'session':(data[9]||'').hexEncode()
						, 'profileimg':data[10]
					};
					this.key[data[0]] = this.user_data[data[1]] = user;

					break;
				case 'join':
					log(this.uuid, '접속 데이터', this.installData.user_data);
					var self = this;
					//if(this.joined) return;
					if(this.installData.user_data) {
						this.goJoin(this.parseDATA(this.installData.user_data));
					} else if(this.installData.user_data_url) {
						// 유저 데이터 url 인경우
						var self = this;
						jsLoad(this.installData.user_data_url+'?room='+this.id, 'token', this.id, function( data ) { 
							self.goJoin(self.parseDATA(data));
						});
						break;
					} else {
						// 일단 접속문구
						var data = {
							'user' : {
								'nick' : this.nick
							}
						};
						if(!hook(this, 'before.join', data)) return false;
						this.goJoin(data.user);
					}
					//this.joined = true;

					if(this.installData.invite) {
						this.socket.send(['command', 'invite', unescape(this.installData.invite)])
						this.installData.invite = '';
					}
					break;
				case 'roomInfo':
					extend(this.info, {
						id : this.id
						, name : data[0]
						, mode : parseInt(data[1])
						, created : getTimeStamp(data[2])
					});

					for(var i in roomFunctionCode) {
						this.info[ roomFunctionCode[i] ] = data[3].charCodeAt(parseInt(i/8))>>(i%8)&1;
					}

					// 시간 간격
					if(data[4])
						time_interval = parseInt(new Date().getTime()/1000) - data[4];
					log(this.uuid, '방설정 입니다', this.info);
					break;
				case 'update':
					var changed = {};
					for (var i = 0, limit = data.length; i < limit; i++ ) {
						var key = data[i]
							, value = data[++i]

						changed[key] = value;
					}
					if(!hook(this, 'before.update', changed)) return false;
					this.trigger( 'update', changed);
					extend(this.info, changed);
					hook(this, 'after.update', changed);
					break;
				case 'myInfo':
					var user = this.key[data[0]];
					this.key[data[0]] = this.user_data[user['nick']] = this.users[escape(user['nick'])] = extend(this.my, user);
					this.nick = user['nick'];
					log(this.uuid, '내정보', this.my);
					var hook_data = {
						my : copy(this.my)
					};
					this.trigger( 'join', hook_data);
					hook(this, 'after.join', hook_data);
					break;

				case 'disconnect':
					if(!hook(this, 'before.disconnect', {})) return false;
					this.trigger( 'disconnect', {});
					this.joined = false;
					var $this = this;
					if(this.socket.disconnect_reason == 'network_error' && !this.reconnect_interval && this.last_data != 'error' && this.my.nick)
						this.reconnect_interval = setInterval(function() {
							if(!document.hasFocus())
								return;
							if($this.socket.isConnect()) {
								clearInterval($this.reconnect_interval);
								$this.reconnect_interval = '';
								return;
							}
							//this.socket.start('re');
							//room.socket.disconnect();
							$this.socket = new socket( $this );
							clearInterval($this.reconnect_interval);
							$this.reconnect_interval = 0;

						}, 1000);
					hook(this, 'after.disconnect', {});
					break;
				case 'control':
					var hook_data = {
						type : data[0]
					};
					switch(hook_data['type']) {
						case 'getPayment':
							var self = this;
							jsLoad('//notice.uchat.io/payment.php?server='+server_name+'&mb_id='+escape(self.my.id)+'&token='+data[1], 'admin_payment_toplayer', function(result) { // notice.uchat.io 에서 공지사항을 끌고온다.
								for(var i = 0, len = result.length; i < len; i++) { 
									self.queue(['system', 40, result[i]['content'], result[i]['bgcolor'], result[i]['ftcolor'], parseInt(result[i]['start']), parseInt(result[i]['end']), parseInt(result[i]['maintain']), result[i]['link'], parseInt(result[i]['weight']) || 100]);
								}
							});
							return;
							break;
						case 'closeIndividual':
							if(this.individual) {
								this.individual.close();
								delete this.individual;
							}
							return;
							break;
					}
					if(!hook(this, 'before.control', hook_data)) return false;
					this.trigger( 'control', hook_data);
					hook(this, 'after.control', hook_data);
					break;
				case 'message':
					if(!this.key[data[0]]) log(this.uuid, '키에러');
					//self.user['nick'], self.user['id'], self.user['level'], self.user['auth'], self.user['icons'], self.user['nickcon'], self.user['created']
					var user = copy(this.key[data[0]]);

					//data[2] = data[2].replace(/</gi, "&lt;");
					/* 세팅부분 주석
					if(setting[this.id]['option.link']) {
						data[2] = linkify(data[2]);
					}
					*/

					//data[2] = linkify(data[2]);
					var style = {bold: false, italic:false, underline:false, size:'9pt'};
					data[1] = data[1].split(' ');
					/*
					for(var i =0; i<data[1].length; i++)
						style[data[1][i]] = true;
						*/
					data[1][0] = parseInt(data[1][0]);
					if(data[1][0] & 4)
						style['bold'] = true;
					if(data[1][0] & 2)
						style['italic'] = true;
					if(data[1][0] & 1)
						style['underline'] = true;
					if(data[1][1] && data[1][1].match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)) {
						style['color'] = data[1][1];
					} else {
						style['color'] = this.default_setting['style.color'] || '#000000';
					}
					var hook_data = {
						user : user
						, style : style
						, content : data[2]
						, created : data[3] ? getTimeStamp(data[3]) : getTimeStamp()
						, time : data[3] ? data[3] : getServerSecond()/1000
					};
					if(!hook(this, 'before.message', hook_data)) return false;
					if(user['auth'] < constant['AUTH_SUBADMIN'] && isArray(this.setting.ignores) && indexOf(this.setting.ignores, user['session']) != -1)
						break;
					this.trigger( 'message', hook_data);
					hook(this, 'after.message', hook_data);
					//log('스킨한테 넘어가는 메세지 길이', data[2], toEmoticon(data[2]));
					break;

				case 'userInfo':
					if(data[0]) {
						var user = this.key[data[0]];
						if(!user['nick']) log('유저 인포 키에러');
						if(user['nick'] == this.nick)
							this.users[escape(user['nick'])] = extend(this.my, user);
						else
							this.users[escape(user['nick'])] = user;//extend(this.users[escape(user['nick'])]||{}, user);
						this.tempArr['userlist'] = this.tempArr['userlist'] || [];
						this.tempArr['userlist'].push(copy(user));
					} else {
						if(this.tempArr['userlist']) {
							var hook_data = {
								'list' : this.tempArr['userlist']
							};
							if(!hook(this, 'before.user.list', hook_data)) return false;
							this.trigger( 'user.list', hook_data);
							hook(this, 'after.user.list', hook_data);
						}
						delete this.tempArr['userlist'];
					}
					break;
				case 'userModi':
					var targetUid = data.shift();
					var target = this.key[targetUid];
					var afterUid = data.shift();
					var after = this.key[afterUid];

					var changed = {};
					for(var i = 0, len = data.length; i < len; i++) {
						var key = data[i];
						var value = data[++i];

						changed[key] = value;
					}

					var hook_data = {
						target : target.nick
						, changed : changed
					};
					if(!hook(this, 'before.user.modi', hook_data)) return false;

					for(var key in changed) {
						/*
						if(this.user_data && this.user_data[target]) {
							this.user_data[target][key] = changed[key];
						}
						*/

						/*
						if(key == 'nick') {
							this.user_data[changed[key]] = this.users[escape(changed[key])] = this.users[escape(target)];

							if(this.users[escape(changed[key])] == this.my) {
								//setCookie('Uchat_'+this.id, escape(changed[key]), 360);
								this.nick = changed[key];
								save_room_settings();
							}
						}
						*/
					}
					if(target.session === this.my.session)
						extend(this.my, after);
					if(changed['nick']) {
						this.nick = this.my['nick'];
						delete this.users[escape(target)];
						save_room_settings();
					}
					this.trigger( 'user.modi', hook_data);
					hook(this, 'after.user.modi', hook_data);
					break;
				case 'userJoin':
					var user = this.key[data[0]];
					this.users[escape(user['nick'])] = user;

					var hook_data = {
						user : copy(user) 
					};
					//log('유저수', this.users);
					if(!hook(this, 'before.user.join', hook_data)) return false;
					this.trigger( 'user.join', hook_data);
					hook(this, 'after.user.join', hook_data);
					break;

				case 'userQuit':
					var hook_data = {
						user : { 'nick' : data[0] }
					};
					if(!hook(this, 'before.user.quit', hook_data)) return false;
					this.trigger( 'user.quit', hook_data);
					delete this.users[escape(data[0])];
					hook(this, 'after.user.quit', hook_data);
					break;

				case 'userCount':
					var hook_data = {
						count : data[0]*1
					};

					if(!hook(this, 'before.user.count', hook_data)) return false;
					this.trigger( 'user.count', hook_data);
					hook(this, 'after.user.count', hook_data);

					break;

				case 'error':
					var hook_data = {
						code : data[0]
					};
					if(!hook(this, 'before.error', hook_data)) return false;
					switch(hook_data.code) {
						case 502:
							if(this.individual && this.individual.closed) {
								this.individual.close();
								delete this.individual;
							}
							break;
					}
					this.trigger( 'error', hook_data);
					hook(this, 'after.error', hook_data);
					break;

				case 'whisper':
					var from = this.key[data[0]], to = this.key[data[1]];
					/*
					if(this.setting['option.link']) {
						data[3] = linkify(data[3]);
					}*/
					var hook_data = {
						from : copy(from)
						, to : copy(to)
						, style : data[2]
						, content : data[3]
						, created : data[4] ? getTimeStamp(data[4]) : getTimeStamp()// || getTimeStamp()
					};
					if(!hook(this, 'before.whisper', hook_data)) return false;

					if(from['auth'] < constant['AUTH_SUBADMIN'] && isArray(this.setting.ignores) && this.setting.ignores.indexOf(from['session']) != -1) // 무시하기를 아이디 기반으로
						break;
					if(this.setting && !this.setting['access.whisper'])
						break;
					this.trigger( 'whisper', hook_data);
					hook(this, 'after.whisper', hook_data);
					break;

				case 'system':
					var type = data.shift();
					type = systemCode[type*1];
					switch(type) {
						case 'to_call': //만약호출이라면
							var from = this.key[data[0]];
							var to = this.key[data[1]];
							if(this.my.nick != from.nick) {
								type = 'from_call';

								if(this.setting && !this.setting['access.call'])
									return false;
							}
							data[0] = from.nick;
							data[1] = to.nick;
							break;
						case 'invite':
							var from = this.key[data[0]];
							var to = this.key[data[1]];
							if(from.nick == this.my.nick)
								type = 'invite_notice';
							else if(this.setting && !this.setting['access.invite'])
								return false;
							data[0] = from.nick;
							data[1] = to.nick;
							break;
						case 'mute':
							if(data[2] == -1)
								type = 'permanent_mute';
							break;
						case 'muted':
							if(data[0] == -1)
								type = 'permanent_muted';
							break;
					}
					var hook_data = {
						type: type
						, data : data
					};
					if(!hook(this, 'before.system', hook_data)) return false;

					switch(hook_data['type']) {
						case 'from_call':
						case 'invite':
							if(from['auth'] < constant['AUTH_SUBADMIN'] && isArray(this.setting.ignores) && indexOf(this.setting.ignores, from['session']) != -1) // 호출 기능은 사용되지 않음.
								return;

					}

					this.trigger( 'system', hook_data);
					switch(type) {
						case 'ban':
							if(data[1] != this.my.nick)
								break;
							this.socket.disconnect('banned');
					}
					hook(this, 'after.system', hook_data);
					break;
				case 'individualJoin':
					//this.individual.document.charset = ua.charset;
					var $this = this;
					var html = '';
					html += '<!doctype html>';
					html += '<html lang="kr">';
					html += '<head>';
					html += '	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, target-densityDpi=medium-dpi" />';
					html += '	<meta http-equiv="X-UA-Compatible" content="IE=edge">';
					html += '	<meta charset="utf-8">';
					html += '	<style>';
					html += '		html, body {padding:0;margin:0;}';
					html += '		html, body{';
					html += '		font-size:0;overflow:hidden;line-height:0;height:100vh;';
					html += '			}';
					html += '		#wrap {height:100%;}';
					html += '		#wrap iframe {width:100%;font-size:0;overflow:hidden;line-height:0;}';
					html += '	</style>';
					html += '	<script type=\'text/javascript\' data-src="'+client_url+'">';
					html += '	(';
					html += UchatClass.toString();
					html += '	)(window, document, undefined);';
					html += '	<\/script>';
					html += '</head>';
					html += '<body>';
					html += '<div id="wrap">';
					html += '<script type=\'text/javascript\'>';

					var joinData = {};
					for(var i = 0, len = data.length; i<len; i++) {
						joinData[data[i]] = data[++i];
					}

					joinData['skin'] = $this.installData.skin;
					//joinData['rending'] = $this.individual.document.getElementById('wrap');
					joinData['invite'] = $this.invite_temp;
					delete $this.invite_temp;
					joinData['width'] = '100%';
					joinData['height'] = Uchat.ua.ios?'100vh':'100%';

					html += 'Uchat.room('+JSONStringify(joinData)+')';
					html += '<\/script>';
					html += '</div>';
					html += '</body>';
					html += '</html>';
					setTimeout(function() {
						$this.individual.document.open();
						$this.individual.document.write(html);
						$this.individual.document.close();
					});
					break;
				default:
					this.trigger(eventtype, data);
			}
			if(indexOf(['userJoin', 'userQuit', 'userCount'], eventtype) == -1)
				this.last_data = eventtype;
		},
		installPlugin: function() {
			for(var i in this.arguments.plugin_list) {
				var v = this.arguments.plugin_list[i];
				cache.plugin[v] && typeof cache.plugin[v] == 'function' && cache.plugin[v](this.skin_adapter, {setting:this.plugin_setting[v]||{}, path:path.PLUGIN+'/'+v});
			}
		}
		, onDestory: function() { 
			if(this.installData.user_data_url)
				delete this.installData.user_data;
		}

	};


function skin_adapter(room) {
	if( this instanceof skin_adapter == false ) {
		return false;
	}
	var skin = this;
	this.id = room.id;
	this.doc;
	this.wrap = room.wrap;
	this.agent = ua;
	this.getTimeStamp = getTimeStamp
	this.now = getServerSecond
	/*
		this.log = function ( msg ) {
			log(msg);
		};
		*/
	this.language = extend({}, language['kr']);
	this.reload = function() {
		if(room.installData.mode == 'popup') {
			return false;
		}
		room.destory();
		room.reinstall();
		//loadData(path['SKIN_LOCATION'], room.id, '&skin='+room.skin+'&encoding='+charset/*+'&r='+(new Date().getTime())*/);
	};
	this.skin = {
		arguments : room.arguments
	}
	this.on = function(type, fn) {
		//if(room.event) room.event[type] = fn;
		api.push([room.id, type, fn]);
		if(rooms[room.id].skin_ready && parsing_event_name(type)[0] == 'after.create') {
			fn(rooms[room.id].skin_adapter, {id : room.id});
		}
		return this;
	};

	this.off = function(type) { 
		var v = parsing_event_name(type);
		for(var t=api.length;t>0;) {
			var pe = parsing_event_name(api[--t][1]);
			if((api[t][0] == room.id)
				&& ((api[t][1] == type)
					|| (pe[1] && v[1]  && pe[1] == v[1])
					|| (pe[0] && v[0]  && pe[0] == v[0])))
				api.splice(t,1);
		}
	}

	this._on = function(type, fn) {
		room.event.push([type, fn]);
	}

	this.setting = {
		data: room.setting
		, init: function(data) {
			extend(room.default_setting, data);
			extend(room.setting, data, room_settings[room.id]);
		}
		, set: function(key, data) {
			room.setting[key] = data;
			save_room_settings();
		}
		, get: function(key) {
			return room.setting[key];
		}
		, save: function() {
			save_room_settings();
		}
	};

	this.print = function (message) {
		room.on('system', [12, message]);
	}

	this.plugin = {
		// 설정상수
		TO_ALL : 0,
		ONLY_ME : 1,
		list : room.pluginList, 
		add: function(channel) { 
			if ( !this.list[channel] ) {
				this.list[channel] = {
					id : channel,
					receiver : [],
					parser : [],
					send: function(data) {
						room.socket.send(['plugin', channel].concat(data));
					},
					sendTo: function(target, data) {
						room.socket.send(['pluginTo', target, channel].concat(data));
					},
					onReceived : function(fn) {
						this.receiver.push(fn);
					},
					addParser : function( callback ) {
						this.parser.push(callback);
					}, 
					destory : function() {
						delete room.pluginList[channel];
					}
				}
			}
			return this.list[channel];
		}
	}

	this.action = {
		send : function ( message, style ) {
			if(!room.socket.isConnect() || !message)
				return;
			if(!style)
				var style = {};

			var hook_data = {
				bold : style.bold
				, italic : style.italic
				, underline : style.underline
				, color : style.color
				, message : message
			};
			if(!hook(room, 'before.send', hook_data)) return false;
			//room.on("message", [myInfo.nick, style, message]);
			var style_result = '', style_on = 0, styleColor = '';
			if(hook_data.bold)
				style_on += 4;
			if(hook_data.italic)
				style_on += 2;
			if(hook_data.underline)
				style_on += 1;
			if (hook_data.color) {
				if(/^#(?:[0-9a-fA-F]{3}){1,2}$/.exec(hook_data.color) !== null) {
					styleColor = hook_data.color;
				} else if(/^rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)$/i.exec(hook_data.color) !== null) {
					styleColor = rgb2hex(hook_data.color);
				} else {
					styleColor = colourNameToHex(hook_data.color);
				}
			}



			if (style_on)
				style_result += style_on;
			if (styleColor && styleColor != room.default_setting['style.color'])
				style_result += ' '+styleColor;
			room.socket.send(['m', style_result, hook_data['message'].replace(/\xA0/g, ' ')]);
			hook(room, 'after.send', hook_data);
		}
		, report : sendReport
		, plugin : function( type, data ) {
			var hook_data = {
				type : type,
				data : data
			};
			if(!room.pluginList[type]) return false;
			if(!hook(room, 'before.plugin', hook_data)) return false;
			if ( room.pluginList[type] && room.pluginList[type].parser ) {
				for( var i = 0,l = room.pluginList[type].parser.length; i <l ; i++ ) {
					if(room.pluginList[type].parser[i](data) === false)
						return false;
				}
			}

			hook(room, 'after.plugin', hook_data);
			return true;
		}
		, command : function () {
			if(!room.socket.isConnect())
				return;
			var data = [].slice.call(arguments);
			var commandType = data.shift();
			var hook_data = {type : commandType, data:data};
			if(!hook(room, 'before.command', hook_data)) return false;
			if(room.commandList[commandType]) {
				room.commandList[commandType].call(room, hook_data.data);
			} else {
				room.socket.send(['command', commandType].concat(hook_data.data))
			}
			hook(room, 'after.command', hook_data);
		}

	};
	this.user = {
		list : room.users,
		get : function ( nick ) {
			if(room.user_data[nick])
				return room.user_data[nick];
			else
				return undefined;
		}
	};
	this.info = room.info;
	this.my = room.my;
	this.log = {
		//last_whisper : ''
		//, ignores : ignores
	};
	this.disconnect = function() {
		room.socket.disconnect();
	}
};

function socket(room) {
	if( this instanceof socket == false )
		return new socket(room);
	this.id = randomString(12);
	this.room = room;
	this.connect_count = 0;
	this.socket_init = false;
	this.stream = [];
	this.protocol = new protocols.fail(this);
	this.maybeServerError = false;
	this.connectInfo = undefined;
	this.retryTimeout = 0;
	this.init();
	return this;
}
socket.fn = socket.prototype = {
	init: function() {
		var protocol_list_count = protocol_list.length;
		for(var i=0; i<protocol_list_count; i++) {
			var protocol = new protocols[protocol_list[i]](this);
			if(protocol.isAble()) {
				log( this.id, protocol.name);
				this.protocol = protocol;
				this.protocol.install();
				break;
			}
		}
		var $this = this;
		this.count = 0;

	}
	, onData: function(data) {
		if(isArray(data)) {
			this.stream = this.stream.concat(data);
			var line = bytelinesplit(this.stream);
			this.stream.length = 0;
			var last = line.pop();
			if(last)
				this.stream = last;
			for(var i = 0, len = line.length;i<len; i++) {
				if(!line[i][0]) continue;
				//log('온 데이터', line[i]);
				this.event(bytesplit(line[i]));
			}
		} else {
			this.stream.push(unescape(data));
			var line = linesplit(this.stream.join(''));
			this.stream.length = 0;
			var last = line.pop();
			if(last)
				this.stream.push(last);
			for(var i = 0, len = line.length;i<len; i++) {
				if(!line[i]) continue;
				//log(line[i].hexEncode());
				this.event(split(line[i]));
			}
		}

	}
	, event: function(result) {
		if(!this.room) return false;
		log(this.id, 'rece', result);
		switch( result.shift() ) {
			case 'a':
				this.room.on("control", result);
				break;
			case 'debug':
				log(result[0]);
				break;
			case 'socketInit':
				log(this.id, this.room.uuid, "socket.event.socketInit", this.room.readyConnected);
				this.connect();
				break ; // 180401 임시조치
				this.socket_init = true;
				this.room.readyConnect();
				//var $this = this;
				break;
			case 'serverList':
				/*
					var serverInfo = serverList[Math.floor(Math.random()*serverList.length)].split(':');
					host = serverInfo[0];
					port = serverInfo[1] * 1;
					if(socket && socket.isInit)
					socket.connect(host, port);
					socket_class.event('m|||'+host+':'+port+' 로 입장중.\n');
					*/
				break;
			case 'joinData':
				this.room.on("joinData", result);
				break;
			case 'langData':
				break;
			case 'layout':
				this.room.on("skin", result.join('\x03'));
				break;
			case 'i1':
				this.room.on("roomInfo", result);
				break;
			case 'b':
				this.room.on("update", result);
				break;
			case 'i2':
				this.room.on("myInfo", result);
				break;
			case 'u':
				this.room.on("userInfo", result);
				break;
			case 'd':
				this.room.on("userModi", result);
				break;
			case 'j':
				this.room.on("userJoin", result);
				break;
			case 'o':
				this.room.on("userQuit", result);
				break;
			case 'a':
				this.room.on("userNickChanged", restul);
				break;
			case 'c':
				this.room.on("userCount", result);
				break;
			case 'p':
				this.room.on('plugin', result);
				break;
			case 'onConnect':
				this.onConnect();
				break;
			case 'onDisconnect':
				this.onDisconnect();
				break;
			case 'm':
				this.room.on("message", result);
				break;
			case 'w':
				this.room.on("whisper", result);
				break;
			case 's':
				this.room.on("system", result);
				break;
			case 'i':
				this.room.on("individualJoin", result);
				break;
			case 'l':
				this.room.on("childList", result);
				break;
			case 'e':
				this.room.on("childJoin", result);
				break;
			case 'd': // 이거 뭔데 겹치냐
				this.room.on('motherUserList', result);
				break;
			case 'k':
				this.room.on('key', result);
				break;
			case 'ERR':
				if(!this.room.my.nick && !session) sendReport(true);
				this.room.on("error", result);
				/*
					switch(result[0]*1) {
					case 101:
					case 102:
					case 103:
					case 201:
					case 202:
					case 203:
					case 204:
					case 301:
					case 303:
					case 401:
					case 405:
					case 408:
					this.disconnect('error');
					}
					*/
				break;
			default :
				log(result);
				log('프로토콜 해석 못함');
		}
	}

	, isConnect: function() {
		return this.protocol.connected();
	}

	, disconnect: function (reason) {
		if(!this.protocol.connected())
			return;
		this.send(['disconnect']);
		this.clearRetryTimeout();
		this.disconnect_reason = reason;
		try {
			this.protocol.disconnect(reason?reason:'disconnect');
		} catch(e) {}
	}
	, destory: function() {
		log(this.id, '방 소켓 파괴 ');
		this.room && clearTimeout(this.room.bugReportingTimer);
		this.room && this.room.onDestory();
		this.room = undefined;
		this.disconnect();
	}

	, start: function ( reason ) {
		//room.on("connect", {});
		log("socket.start")

	}
	, start_ping: function () {
		if(!this.ping_interval) {
			var $this = this;
			this.ping_interval = setInterval(function() {
				if($this.protocol.connected())
					$this.send(['p']);
			}, setting['heartbeat']*1000);
		}
	}

	, send: function ( msg ) {
		log(this.id, 'send:', msg);
		if(!this.isConnect())
			return;
		if(this.protocol.type == 'byte') 
			var data = bytelinedelimiter(bytedelimiter(msg));
		else
			var data = linedelimiter(delimiter(msg));
		this.protocol.packet_send( data ) ;
	}
	, connect: function(i) {
		var i = parseInt(i || 0);
		var result = [server[0]];

		var preferredPort = parseInt(getCookie("UchatPreferredPort"));
		if(preferredPort && server[1].indexOf(preferredPort) !== -1) {
			result[1] = preferredPort;
		} else {
			if(i >= server[1].length) {
				i = 0;
				this.maybeServerError = true;
			}
			result[1] = server[1][i];
		}

		this.protocol.connect(result);
		this.connectInfo = result;
		log(this.id, '연결시도', result, this.maybeServerError);
		var self = this;
		if(!this.retryTimeout) {
			this.retryTimeout = setTimeout(function() {
				if(self.isConnect()) {
					self.setPreferredPort(server[0][1][i]); 
					return false;
				}
				if(preferredPort) {
					deleteCookie('UchatPreferredPort');
					self.maybeServerError = true;
				}
				self.protocol.disconnect();
				self.connect(i+1);
			}, 3000);
		}
	}
	, clearRetryTimeout: function() {
		this.retryTimeout && clearTimeout(this.retryTimeout);
	}
	, setPreferredPort: function(port) {
		if(!port) return false;
		if(!this.isConnect()) return false;
		if(port == server[0][1][0]) return false;
		if(this.maybeServerError) return false;
		setCookie('UchatPreferredPort', port, 365);
	}
	, onConnect: function() {
		log(this.id, 'socket.on.onConnect');
		this.disconnect_reason = '';
		this.connect_count+=1;
		this.start_ping();
		this.clearRetryTimeout();
		this.room.on("socketInit", {});
	}
	, onDisconnect: function() {
		try {
			clearInterval(this.ping_interval);
		} catch(e) {
			try {
				clearTimeout(this.ping_interval);
			} catch(e) {
			}
		}
		this.ping_interval = '';
		this.start_list = [];
		if(!this.disconnect_reason)
			this.disconnect_reason = 'network_error';
		this.room.on("disconnect", {});
		this.protocol.onDisconnect();
		log('연결끊김');
	}
	, checkPort: function ( port ) {
		
	}


};

win.Uchat = {
	room: room
	, socket: socket
	, ua: ua
	, version: "1.0"
};

onLoad(function() { // async + 커스텀태그를 위한 코드.
	jsLoad('//notice.uchat.io/notice.php?server='+server_name, 'admin_toplayer', function(data) { // notice.uchat.io 에서 공지사항을 끌고온다.
		for(var i = 0, len = data.length; i < len; i++) { 
			for(var j in rooms) { 
				rooms[j].queue(['system', 40, data[i]['content'], data[i]['bgcolor'], data[i]['ftcolor'], parseInt(data[i]['start']), parseInt(data[i]['end']), parseInt(data[i]['maintain']), data[i]['link'], parseInt(data[i]['weight']) || 30]);
			}
		}
	});

	var UChat_tag = doc.getElementsByTagName('U-Chat'); // 유챗 설치
	for(var i = 0, limit = UChat_tag.length; i < limit; i++) {
		if(!UChat_tag[i].getAttribute('room')) continue;
		var option = { wrap : UChat_tag[i] },
			attrs = UChat_tag[i].attributes,
			j = attrs.length,
			attr;
		while (j--) {
			attr = attrs[j];
			if(attr.name == 'style') continue;
			option[attr.name] = attr.value;
		}
		Uchat.room(option);
	}
});
//var bugReportingTimer = setTimeout(sendReport, 5000);
function sendReport(power) { // 버그 리포팅
	return false;
	if(ua.userAgent.match(/googlebot/g)) return false;
	var frist_room;
	for(var key in rooms) {
		if(rooms.hasOwnProperty(key)) {
		    frist_room = rooms[key];
		    //break; // 마지막꺼 가져오기로
		}
	}
	if(frist_room.socket.isConnect()&&!power) return false;
	var content = [];
	content.push(getTimeStamp()+' '+ua.userAgent);
	content.push(getTimeStamp()+' '+frist_room.socket.name);
	content.push(getTimeStamp()+' '+window.location.href);
	for(var i=0, protocol_list_count = protocol_list.length; i<protocol_list_count; i++) {
		content.push(getTimeStamp()+' '+protocol_list[i]+':'+protocols[ protocol_list[i] ]());
	}
	//log(content, frist_room);
	//document.createElement("img").src='//uchat.io/report.php?content='+encodeURIComponent(content.join('\n'));
	var i = document.createElement('iframe');
	i.style.display = 'none';
	//i.onload = function() { i.parentNode.removeChild(i); };
	i.name = 'sendLOGS';
	document.body.appendChild(i);

	var portRESULT = false;

	frist_room.event['system']({type:'notice', data:['포트 테스트 : '+server[0][1]]});
	var porttest = setTimeout(function() {
		frist_room.event['system']({type:'notice', data:['포트 테스트 : '+server[0][1]+' 실패']});
	}, 5000);
	window.UchatPortTest = function(data) {
		clearTimeout(porttest);
		frist_room.event['system']({type:'notice', data:['포트 테스트 : '+server[0][1]+' 성공']});
		portRESULT = true;
		return false;
	};


	jsLoad('//'+server[0][0]+':'+server[0][1]+'/UchatPortTest.js');
	setTimeout(function() { 
		if(frist_room.socket.connect_count&&!power) return false;
		content.push(getTimeStamp()+' '+'접속카운트 ' + frist_room.socket.connect_count);
		content.push(getTimeStamp()+' '+'포트테스트결과 : '+portRESULT);
		content.push(getTimeStamp()+' '+'html 길이:'+frist_room.iframe.doc.body.innerHTML.length);
		frist_room.event['system']({type:'notice', data:['버그 리포팅 전송.']});
		post ( '//'+domain.web+'/report.php' , {content: content.join('\n')+logs} , 'post', 'sendLOGS'); 
	}, 5000);
}

if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function (searchElement, fromIndex) {
		if ( this === undefined || this === null ) {
			throw new TypeError( '"this" is null or not defined' );
		}

		var length = this.length >>> 0; // Hack to convert object.length to a UInt32

		fromIndex = +fromIndex || 0;

		if (Math.abs(fromIndex) === Infinity) {
			fromIndex = 0;
		}

		if (fromIndex < 0) {
			fromIndex += length;
			if (fromIndex < 0) {
				fromIndex = 0;
			}
		}

		for (;fromIndex < length; fromIndex++) {
			if (this[fromIndex] === searchElement) {
				return fromIndex;
			}
		}

		return -1;
	};
}
function indexOf(data, searchElement, fromIndex) {
	if ( data === undefined || data === null ) {
		throw new TypeError( '"data" is null or not defined' );
	}

	var length = data.length >>> 0; // Hack to convert object.length to a UInt32

	fromIndex = +fromIndex || 0;

	if (Math.abs(fromIndex) === Infinity) {
		fromIndex = 0;
	}

	if (fromIndex < 0) {
		fromIndex += length;
		if (fromIndex < 0) {
			fromIndex = 0;
		}
	}

	for (;fromIndex < length; fromIndex++) {
		if (data[fromIndex] === searchElement) {
			return fromIndex;
		}
	}

	return -1;
}
if (!Array.prototype.reduce) {
	Array.prototype.reduce = function(callback) {
		'use strict';
		if (this == null) {
			throw new TypeError('Array.prototype.reduce called on null or undefined');
		}
		if (typeof callback !== 'function') {
			throw new TypeError(callback + ' is not a function');
		}
		var t = Object(this), len = t.length >>> 0, k = 0, value;
		if (arguments.length == 2) {
			value = arguments[1];
		} else {
			while (k < len && !(k in t)) {
				k++;
			}
			if (k >= len) {
				throw new TypeError('Reduce of empty array with no initial value');
			}
			value = t[k++];
		}
		for (; k < len; k++) {
			if (k in t) {
				value = callback(value, t[k], k, t);
			}
		}
		return value;
	};
}
if (typeof String.prototype.trimLeft !== "function") {
	String.prototype.trimLeft = function() {
		return this.replace(/^\s+/, "");
	};
}
if (typeof String.prototype.trimRight !== "function") {
	String.prototype.trimRight = function() {
		return this.replace(/\s+$/, "");
	};
}
if (typeof Array.prototype.map !== "function") {
	Array.prototype.map = function(callback, thisArg) {
		for (var i=0, n=this.length, a=[]; i<n; i++) {
			if (i in this) a[i] = callback.call(thisArg, this[i]);
		}
		return a;
	};
}
function save_room_settings() {
	var result = [];
	result.push(session);
	for(var i in rooms) {
		var diff_arr = diff(rooms[i].setting, rooms[i].default_setting);
		if(!isEmpty(diff_arr) || rooms[i].nick)
			result.push(i+' '+(parseInt(new Date().getTime()/1000)+(7*60*60*24))+' '+rooms[i].nick+' '+JSONStringify(diff_arr));
	}
	for(var i in room_settings) {
		if(!rooms[i])
			if(!isEmpty(room_settings[i]) || room_nicknames[i])
				result.push(i+' '+room_settings_expiry[i]+' '+room_nicknames[i]+' '+JSONStringify(room_settings[i]));
	}
	setCookie('UCHAT_SETTINGS', escape(result.join('\n')), 365);
}

function onFullLoad( fn ) {
	var done = false,
		top = true,

		doc = win.document,
		root = doc.documentElement,

		add = doc.addEventListener ? 'addEventListener' : 'attachEvent',
		rem = doc.addEventListener ? 'removeEventListener' : 'detachEvent',
		pre = doc.addEventListener ? '' : 'on',

		init = function (e) {
		 	if (e.type == 'readystatechange' && doc.readyState != 'complete') return;
		 	(e.type == 'load' ? win : doc)[rem](pre + e.type, init, false);
		 	if (!done && (done = true)) fn.call(win, e.type || e);
		},

		poll = function () {
		 	try {
				root.doScroll('left');
		 	}
		 	catch (e) {
				setTimeout(poll, 50);
				return;
		 	}
		 	init('poll');
		};

	if (doc.readyState == 'complete') fn.call(win, 'lazy');
	else {
		if (doc.createEventObject && root.doScroll) {
			try {
				top = !win.frameElement;
			}
			catch (e) {}
			if (top) poll();
		}
		//doc[add](pre + 'DOMContentLoaded', init, false);
		//doc[add](pre + 'readystatechange', init, false);
		win[add](pre + 'load', init, false);
	}
}


function onLoad( fn ) {
	var done = false,
		top = true,

		doc = win.document,
		root = doc.documentElement,

		add = doc.addEventListener ? 'addEventListener' : 'attachEvent',
		rem = doc.addEventListener ? 'removeEventListener' : 'detachEvent',
		pre = doc.addEventListener ? '' : 'on',

		init = function (e) {
		 	if (e.type == 'readystatechange' && doc.readyState != 'loading') return;
		 	(e.type == 'load' ? win : doc)[rem](pre + e.type, init, false);
		 	if (!done && (done = true)) fn.call(win, e.type || e);
		 	if(done)
		 		log('done');
		},

		poll = function () {
		 	try {
				root.doScroll('left');
		 	}
		 	catch (e) {
				setTimeout(poll, 50);
				return;
		 	}
		 	init('poll');
		};

	if (doc.readyState != 'loading') 
		fn.call(win, 'lazy');
	else {
		if (root.doScroll && window == window.top) {
			if (top) poll();
		}
		doc[add](pre + 'DOMContentLoaded', init, false);
		doc[add](pre + 'readystatechange', init, false);
		win[add](pre + 'load', init, false);
	}
}
function isArray (source) {
    return Object.prototype.toString.call(source) === '[object Array]';
}

function isJson (source) {
	return source && source.constructor === {}.constructor;
}

function isStr (source) {
	return source && source.constructor === ''.constructor;
}

function extend (target) {
	var sources = [].slice.call(arguments, 1)
		, count = sources.length
		, source;
	for(var i=0; i<count; i++) {
		source = sources[i];
		for (var prop in source) {
			if(isJson(target[prop]) && isJson(source[prop])) {
				extend(target[prop], source[prop]);
				continue;
			}
			target[prop] = source[prop];
		}
	}
	return target;
}

function copy(data) {
	return extend({}, data);
}

function diff (obj1, obj2) {
	var delta = {};

	for (var x in obj1) {
		if (obj2.hasOwnProperty(x)) {
			if (typeof obj2[x] == "object") {
				//recurse nested objects/arrays
				delta[x] = diff(obj1[x], obj2[x]);
			}
			else {
				//if obj2 doesn't match then - modified attribute
				if (obj2[x] != obj1[x]) {
					delta[x] = obj1[x];
				}
			}        
		}
		else {
			//obj2 doesn't have this - new attribute
			delta[x] = obj1[x];
		}
	}

	return delta;
}


function log() {
	if( query['uchatdebug'] == 1 || debug ) {
		var text = '';
		for (var i =0, len = arguments.length; i<len; i++) {
			text += ' '+ arguments[i];
		}

		if( typeof console == 'object' && typeof console.log == 'function') {
			text += '\n';
			console.log.apply(console, arguments);
		}	else {
			text += '<br>';
			var d = document.getElementById('uchatLog');
			if(!d) return false;
			d.innerHTML = d.innerHTML+text;
		}
		logs += getTimeStamp()+' '+text;
	}
	if( mobiledebug ) {
	}
}

function protocol_escape(data) {
	for(var i = 0; i<data.length; i++) {
		data[i] = ((data[i]||'')+'').replace(/\|/g, '&#124;').replace(/\n/g, '');
	}
	return data?data.join('\x03'):'';
}

function randomString(string_length) {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i=0; i<string_length; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum,rnum+1);
	}
	//document.randform.randomfield.value = randomstring;
	return randomstring;
}

function jsLoad() {
	// 시작
	var arg = Array.prototype.slice.call(arguments);

	var url = arg.shift();
	var fn;
	if(typeof arg[arg.length-1] === 'function')
		fn = arg.splice(-1,1)[0];
	var script = document.createElement("script");

	var done = false;
	var head = document.getElementsByTagName("head")[0] || document.documentElement;

	var now = cache;
	for(var i = 0; i<arg.length; i++) {
		now[arg[i]] = now[arg[i]] || {};
		now = now[arg[i]];
	}

	log('viewload', url);
	script.setAttribute('charset', 'utf-8');
	//log('viewLoad:'+url);
	script.onload = script.onreadystatechange = function(){
		log('viewload-loadding', url, done, this.readyState);
		if ( !done && (!this.readyState || this.readyState == 'loaded' || this.readyState === "complete") ) {
			log('viewload-done', url);
			done = true;
			setTimeout(function() {
				var find = cache;
				for(var i=0; i<arg.length; i++) {
					find[arg[i]] = find[arg[i]];
					find = find[arg[i]];
				}
				fn && typeof fn == 'function' && fn(find);
			}, 4);

			script.onload = script.onreadystatechange = null;
			if ( head && script.parentNode ) {
				head.removeChild( script );
			}
		}
	};
	script.src = url;

	setTimeout(function() { 
		try{ 
			document.getElementsByTagName("head")[0].appendChild(script);
		} catch(e) {
			var m = document.getElementsByTagName('script')[0];
			m.parentNode.insertBefore(script,m);
		}
	});
}
function viewLoad( skin, name, callback ) {
	var script = document.createElement("script");
	var url = path.VIEW_LOCATION+'?skin='+skin+'&name='+name;
	var done = false;
	var head = document.getElementsByTagName("head")[0] || document.documentElement;


	if(cache['skin'] && cache['skin'][skin] && cache['skin'][skin][name] && !debug) {
		callback && typeof callback == 'function' && callback(cache['skin'][skin][name]);
		return true;
	}
	cache['skin'] = cache['skin'] || {};
	cache['skin'][skin] = cache['skin'][skin] || {};

	log('viewload', url);
	script.setAttribute('charset', 'utf-8');
	//log('viewLoad:'+url);
	script.onload = script.onreadystatechange = function(){
		log('viewload-loadding', url, done, this.readyState);
		if ( !done && (!this.readyState || this.readyState == 'loaded' || this.readyState === "complete") ) {
			log('viewload-done', url);
			done = true;
			setTimeout(function() {
				callback && typeof callback == 'function' && callback(cache['skin'][skin][name]);
			}, 4);

			script.onload = script.onreadystatechange = null;
			if ( head && script.parentNode ) {
				head.removeChild( script );
			}
		}
	};
	script.src = url;

	setTimeout(function() { 
		try{ 
			document.getElementsByTagName("head")[0].appendChild(script);
		} catch(e) {
			var m = document.getElementsByTagName('script')[0];
			m.parentNode.insertBefore(script,m);
		}
	});
}
function load(room_id, type, id, callback) {
	var script = document.createElement("script");
	var url = path.LOAD_LOCATION+'?room='+encodeURIComponent(room_id)+'&type='+type+'&id='+id;
	var done = false;
	var head = document.getElementsByTagName("head")[0] || document.documentElement;


	if(cache[type] && ((id && cache[type][id]) || cache[type][room_id])) {
		callback && typeof callback == 'function' && callback( id ? cache[type][id] : cache[type][room_id] );
		return true;
	}

	cache[type] = cache[type] || {};

	script.setAttribute('charset', 'utf-8');


	script.onload = script.onreadystatechange = function (){
		if ( !done && (!this.readyState || this.readyState == 'loaded' || this.readyState === "complete") ) {
			done = true;

			setTimeout(function() { 
				callback && typeof callback == 'function' && callback( id ? cache[type][id] : cache[type][room_id] );
			}, 4);

			script.onload = script.onreadystatechange = null;
			if ( head && script.parentNode ) {
				head.removeChild( script );
			}
		}
	};
	script.src = url;
	setTimeout(function() { 
		try{ 
			document.getElementsByTagName("head")[0].appendChild(script);
		} catch(e) {
			var m = document.getElementsByTagName('script')[0];
			m.parentNode.insertBefore(script,m);
		}
	});

}
function n2b(data) {
	var bin = [];
	while(data) {
		bin.push( String.fromCharCode(data & 0xff) );
		data >>= 8;
	}
	return bin.join('');
}

function b2n(data) {
	var num = 0;
	//log('b2n', data, arr);
	for(var i=0, len = data.length; i<len; i++) {
		//log(' 전', num, arr[i]);
		num += data.charCodeAt(i)<<8*i;
		//if(arr[i]<<8*i < 0) { log('b2n 마이너스감지:', arr[i], arr[i]<<8*i, (arr[i]<<8*i)>>>0); }
	}
	return num;
}

function bytelinesplit ( data ) { 
	var index = 0, result = [], buffer = [], number = 0, last = data.length, escape = [0x0a];

	while ( index < last ) {
		var str = data[index];
		switch(str) {
			case 0x0a:
				result.push(buffer);
				buffer = [];
				break;
			case 0x5c:
				index++;
				if ( index < last ) {
					if ( escape.indexOf( data[index] ) == -1 )
						buffer.push( str );
					buffer.push( data[index] );
				}

				break;
			default:
				buffer.push(str);
		}
		index++;
	}

	result.push(buffer);
	buffer = [];
	return result;

}

function linesplit ( data ) { 
	var index = 0, result = [], buffer = [], number = 0, last = data.length, escape = ['\x0a'];

	while ( index < last ) {
		var str = data.charAt(index);
		switch(str) {
			case '\x0a':
				result.push(buffer.join(''));
				buffer = [];
				break;
			case '\\':
				index++;
				if ( index < last ) {
					if ( escape.indexOf( data.charAt(index) ) == -1)
						buffer.push( str );
					buffer.push( data.charAt( index ) );
				}

				break;
			default:
				buffer.push(str);
		}
		index++;
	}

	result.push(buffer.join(''));
	buffer = [];

	return result;

}

function bytesplit ( data ) {
	var index = 0, result = [], buffer = [], number = 0, mode = 0x03, last = data.length, escape = [0x02, 0x03, 0x04, 0x05, 0x06, 0x07];
	while ( index < last ) {
		var str = data[index];
		switch(str) {
			case 0x02: case 0x03: case 0x04: case 0x05: case 0x06: case 0x07:
				if( mode == 0x02 ) {
					result.push(unescape(buffer.join('')));
				} else if ( mode == 0x03 ) {
					result.push(decodeURIComponent(buffer.join('')));
				} else if ( mode == 0x04 ) {
					if ( buffer.join('') == '%31' )
						result.push(true);
					else 
						result.push(false);
				} else if ( mode == 0x05 ) {
					result.push(b2n(unescape(buffer.join(''))));
				} else if ( mode == 0x06 ) {
					result.push(undefined);
				} else if ( mode == 0x07 ) {
					result.push(Number(unescape(buffer.join(''))));
				}
				buffer.length = 0;
				mode = str;
				break;
			case 0x5c:
				index++;
				if ( index < last ) {
					if ( escape.indexOf( data[ index ] ) == -1 && data[ index ] != 0x5c ) {

						buffer.push('%')
						buffer.push(pad('00', str.toString(16), true));
					}

					buffer.push('%')
					buffer.push(pad('00', data[ index ].toString(16), true));
				}

				break;
			default:
				buffer.push('%')
				buffer.push(pad('00', str.toString(16), true));
		}

		index++;
	}


	if( mode == 0x02 ) {
		result.push(unescape(buffer.join('')));
	} else if ( mode == 0x03 ) {
		result.push(decodeURIComponent(buffer.join('')));
	} else if ( mode == 0x04 ) {
		if ( buffer.join('') == '%31' )
			result.push(true);
		else 
			result.push(false);
	} else if ( mode == 0x05 ) {
		result.push(b2n(unescape(buffer.join(''))));
	} else if ( mode == 0x06 ) {
		result.push(undefined);
	} else if ( mode == 0x07 ) {
		result.push(Number(unescape(buffer.join(''))));
	}
	buffer.length = 0;
	return result;
}

function split ( data ) {
	var index = 0, result = [], buffer = [], number = 0, mode = '\x03', last = data.length, escape = ['\x02', '\x03', '\x04', '\x05', '\x06', '\x07'];

	while ( index < last ) {
		var str = data.charAt(index);
		switch(str) {
			case '\x02': case '\x03': case '\x04': case '\x05': case '\x06': case '\x07':
				if ( mode == '\x02' ) {
					result.push(buffer.join(''));
				} else if ( mode == '\x03' ) {
					result.push(buffer.join(''));
				} else if ( mode == '\x04' ) {
					if ( buffer.join('') == '1' )
						result.push(true);
					else 
						result.push(false);
				} else if ( mode == '\x05' ) {
					result.push(b2n(buffer.join('')));
				} else if ( mode == '\x06' ) {
					result.push(undefined);
				} else if ( mode == '\x07' ) {
					result.push(Number(buffer.join('')));
				}
				buffer.length = 0;
				mode = str;
				break;
			case '\\':
				index++;
				if ( index < last ) {
					if ( escape.indexOf( data.charAt(index) ) == -1 && data.charAt( index ) != '\\' )
						buffer.push( str );
					buffer.push( data.charAt( index ) );
				}

				break;
			default:
				buffer.push(str);
		}
		index++;
	}


	if ( mode == '\x02' ) {
		result.push(buffer.join(''));
	} else if ( mode == '\x03' ) {
		result.push(buffer.join(''));
	} else if ( mode == '\x04' ) {
		if ( buffer.join('') == '1' )
			result.push(true);
		else 
			result.push(false);
	} else if ( mode == '\x05' ) {
		result.push(b2n(buffer.join('')));
	} else if ( mode == '\x06' ) {
		result.push(undefined);
	} else if ( mode == '\x07' ) {
		result.push(Number(buffer.join('')));
	}

	buffer.length = 0;

	return result;
}


function protocol_value_escape( data ) {
	return data.replace(/\\/g, '\\\\').replace(/\x02/g, '\\\x02').replace(/\x03/g, '\\\x03').replace(/\x04/g, '\\\x04').replace(/\x05/g, '\\\x05').replace(/\x06/g, '\\\x06').replace(/\x07/g, '\\\x07');
}

function protocol_value_need_escape(data) { 
	var list = [92, 2,3,4,5,6,7];
	if(list.indexOf(data) !== -1)
		return true;
	else
		return false;
}
function bytelinedelimiter(data) {
	if(!data) return '';
	var result = [];
	if( typeof(data) == 'string' ) {
		result.push( data.replace(/\n/g, '\\\n') );
		result.push('\n');
	} else {
		for( var i = 0, len = data.length; i < len; i++ ) {
			if(data[i] == 10)
				result.push(92);
			result.push(data[i]);
		}
		result.push(10);
	}
	return result;
}

function linedelimiter(data) {
	if(!data) return '';
	var result = [];
	if( typeof(data) == 'string' ) {
		result.push( data.replace(/\n/g, '\\\n') );
		result.push('\n');
	} else {
		for( var i = 0, len = data.length; i < len; i++ ) {
			result.push( data[i].replace(/\n/g, '\\\n') );
			result.push('\n');
		}
	}
	return result.join('')
}

function bytedelimiter( data ) {
	if(!data) return '';
	var result = [];
	for(var i = 0, len=data.length; i<len; i++) {
		switch( typeof(data[i]) ) {
			case 'string':
				if(i)
					result.push(3);
				data[i] = unescape(encodeURIComponent(data[i]));
				for(var j = 0, l = data[i].length; j<l; j++ ) {
					var tmpvalue = data[i].charCodeAt(j);
					if(protocol_value_need_escape(tmpvalue))
						result.push(92);
					result.push( tmpvalue );
				}
				break;
			case 'boolean':
				if(i)
					result.push(4);
				if(data[i])
					result.push(49);
				else
					result.push(48);
				break;
			case 'number':
				if(data[i] % 1 === 0 && data[i] >= 0 ) {
					if(i)
						result.push(5);
					data[i] = n2b(data[i]);
					for(var j = 0, l = data[i].length; j<l; j++) {
						var tmpvalue = data[i].charCodeAt(j);
						if(protocol_value_need_escape(tmpvalue))
							result.push(92);
						result.push( tmpvalue );
					}
				} else {
					if(i)
						result.push(7);
					data[i] = unescape(encodeURIComponent(data[i].toString()));
					for(var j = 0, l = data[i].length; j<l; j++ ) {
						var tmpvalue = data[i].charCodeAt(j);
						if(protocol_value_need_escape(tmpvalue))
							result.push(92);
						result.push( tmpvalue );
					}
				}

				break;
			case 'undefined':
				if(i)
					result.push(6)
				break;
		}
	}
	return result;
}
function delimiter( data ) {
	if(!data) return '';
	var result = [];
	result.push(data[0]);
	for(var i = 1, len=data.length; i<len; i++) {
		switch( typeof(data[i]) ) {
			case 'string':
				if(i)
					result.push('\x03')
				result.push(protocol_value_escape( data[i] ) )
				break;
			case 'boolean':
				if(i)
					result.push('\x04')
				if(data[i])
					result.push('1')
				else
					result.push('0')
				break;
			case 'number':
				if(data[i] % 1 === 0 && data[i] >= 0 ) {
					if(i)
						result.push('\x05');
					result.push( protocol_value_escape( n2b(data[i]) ) );
				} else {
					if(i)
						result.push('\x07');
					result.push( protocol_value_escape( data[i].toString() ) );
				}

				break;
			case 'undefined':
				if(i)
					result.push('\x06')
				break;
		}
	}
	return result.join('')
}
function pad(pad, str, leftPadded) {
	if (str == undefined) return pad;
	if (leftPadded) {
		return (pad + str).slice(-pad.length);
	} else {
		return (str + pad).substring(0, pad.length);
	}
}
function addEvent(elem, event, fn) {
	if(!elem)
		return;
	function cross_argument( e ) {
		if(!e)
			return;
		//e.target = e.target || e.srcElement;
		e._target = e.target || e.srcElement;
		e._pageX = e.pageX || e.clientX + doc.body.scrollLeft + doc.documentElement.scrollLeft;
		e._pageY = e.pageY || e.clientY + doc.body.scrollTop + doc.documentElement.scrollTop;
		try {
			e.rect = e._target.getBoundingClientRect();
		} catch(e) {}
		/*
			e.offsetX = e.clientX - e.rect.left,
			e.offsetY = e.clientY - e.rect.top;
			*/

		return e;
	}
	function listenHandler(e) {
		e = cross_argument(e);
		var ret = fn.apply(this, arguments);
		if (ret === false) {
			e.stopPropagation();
			e.preventDefault();
		}
		return(ret);
	}
	function attachHandler(e) {
		var e = cross_argument(e);
		var ret = fn.call(elem, e);
		if (ret === false) {
			window.event.returnValue = false;
			window.event.cancelBubble = true;
		}
		return(ret);
	}
	var func;
	if (elem.addEventListener) {
		func = listenHandler;
		elem.addEventListener(event, func, false);
	} else {
		func = attachHandler;
		elem.attachEvent("on" + event, func);
	}
	(elem.events = elem.events || []).push({type:event, fn:func});
}

function removeEvent(elem, eventType, handler) {
	if(elem && elem.events && !eventType && !handler) {
		for(var i in elem.events) {
			removeEvent(elem, elem.events[i].type, elem.events[i].fn);
		}
	} else {
		if (elem.removeEventListener)
			elem.removeEventListener (eventType, handler, false);
		if (elem.detachEvent)
			elem.detachEvent ('on'+eventType, handler);
	}
}

function trigger(obj, evt){
	var event; // The custom event that will be created

	if (document.createEvent) {
		event = document.createEvent("HTMLEvents");
		event.initEvent(evt, true, true);
	} else {
		event = document.createEventObject();
		event.eventType = evt;
	}

	event.eventName = evt;

	if (document.createEvent) {
		obj.dispatchEvent(event);
	} else {
		obj.fireEvent("on" + event.eventType, event);
	}


	return;
	var fireOnThis = obj;
	if( document.createEvent ) {
		var evObj = document.createEvent('MouseEvents');
		evObj.initEvent( evt, true, false );
		fireOnThis.dispatchEvent( evObj );
	} else if( document.createEventObject ) { //IE
		var evObj = document.createEventObject();
		fireOnThis.fireEvent( 'on' + evt, evObj );
	}
}
function post(path, params, method, target) {
	method = method || "post"; // Set method to post by default if not specified.

	// The rest of this code assumes you are not using a library.
	// It can be made less wordy if you use one.
	var form = document.createElement("form");
	form.setAttribute("method", method);
	form.setAttribute("action", path);

	for(var key in params) {
		if(params.hasOwnProperty(key)) {
			var hiddenField = document.createElement("input");
			hiddenField.setAttribute("type", "hidden");
			hiddenField.setAttribute("name", key);
			hiddenField.setAttribute("value", params[key]);

			form.appendChild(hiddenField);
		}
	}
	form.target = target;

	document.body.appendChild(form);
	form.submit();
}

function ajax(ops) {
	if(typeof ops == 'string') ops = { url: ops };
	ops.url = ops.url || '';
	ops.method = ops.method || 'get'
	ops.data = ops.data || {};
	ops.async = ops.async || true;

	var getParams = function(data, url) {
		var arr = [], str;
		for(var name in data) {
			arr.push(name + '=' + encodeURIComponent(data[name]));
		}
		str = arr.join('&');
		if(str != '') {
			return url ? (url.indexOf('?') < 0 ? '?' + str : '&' + str) : str;
		}
		return '';
	}
	var last_index = 0;
	var api = {
		host: {},
		process: function(ops) {
			var self = this;
			this.xhr = null;
			if(window.XDomainRequest) { this.xhr = new XDomainRequest(); }
			else if(window.ActiveXObject) { this.xhr = new ActiveXObject('Microsoft.XMLHTTP'); }
			else if(window.XMLHttpRequest) { this.xhr = new XMLHttpRequest(); }
			if(this.xhr) {
				this.xhr.onload = function() {
					var result = self.xhr.responseText;
					if(ops.json === true) {
						result = JSONParse(result); // # 180509 커스텀 부분
					}
					self.doneCallback && self.doneCallback.apply(self.host, [result, self.xhr]);
					self.alwaysCallback && self.alwaysCallback.apply(self.host, [self.xhr]);
					return;
				}
				this.xhr.onerror = function() {
					self.failCallback && self.failCallback.apply(self.host, [self.xhr]);
					self.alwaysCallback && self.alwaysCallback.apply(self.host, [self.xhr]);
					return;
				}
				this.xhr.onprogress = function() {
					var curr_index = self.xhr.responseText.length;
					if (last_index == curr_index) return; 
					var s = self.xhr.responseText.substring(last_index, curr_index);
					last_index = curr_index;
					self.progressCallback && self.progressCallback.apply(self.host, [s, self.xhr]);
					return;
				}
				this.xhr.ontimeout = function() {
					return;
				}
			}
			if(ops.method == 'get') {
				if(this.xhr.overrideMimeType) this.xhr.overrideMimeType('text/plain; charset=x-user-defined');
				this.xhr.open("GET", ops.url + getParams(ops.data, ops.url));
			} else {
				this.xhr.open(ops.method, ops.url, true);
			}
			if(ops.headers && typeof ops.headers == 'object') {
				this.setHeaders(ops.headers);
			}	   
			setTimeout(function() { 
				ops.method == 'get' ? self.xhr.send() : self.xhr.send(ops.low_data || getParams(ops.data)); 
			}, 20);
			return this;
		},
		done: function(callback) {
			this.doneCallback = callback;
			return this;
		},
		fail: function(callback) {
			this.failCallback = callback;
			return this;
		},
		always: function(callback) {
			this.alwaysCallback = callback;
			return this;
		},
		progress: function(callback) {
			this.progressCallback = callback;
			return this;
		},
		setHeaders: function(headers) {
			for(var name in headers) {
				this.xhr && this.xhr.setRequestHeader &&  this.xhr.setRequestHeader(name, headers[name]);
			}
			return this;
		},
		abort: function() {
			this.xhr && this.xhr.abort();
		}
	}
	return api.process(ops);
}
function leadingZeros(n, digits) {
	var zero = '';
	n = n.toString();
	if (n.length < digits) {
		for (var i = 0; i < digits - n.length; i++)
			zero += '0';
	}
	return zero + n;
}
function getServerSecond() { 
	return (parseInt(new Date().getTime()/1000) - time_interval)*1000;
}
function getTimeStamp(time) {
	var d = time?new Date(time*1000):new Date(getServerSecond());
	var s =
		leadingZeros(d.getFullYear(), 4) + '-' +
		leadingZeros(d.getMonth() + 1, 2) + '-' +
		leadingZeros(d.getDate(), 2) + ' ' +
		leadingZeros(d.getHours(), 2) + ':' +
		leadingZeros(d.getMinutes(), 2) + ':' +
		leadingZeros(d.getSeconds(), 2);
	return s;
}

function colourNameToHex(colour)
{
	var colours = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
		"beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
		"cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
		"darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
		"darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
		"darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
		"firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
		"gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
		"honeydew":"#f0fff0","hotpink":"#ff69b4",
		"indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
		"lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
		"lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
		"lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
		"magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
		"mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
		"navajowhite":"#ffdead","navy":"#000080",
		"oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
		"palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
		"red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
		"saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
		"tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
		"violet":"#ee82ee",
		"wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
		"yellow":"#ffff00","yellowgreen":"#9acd32"};

	if (typeof colours[colour.toLowerCase()] != 'undefined')
		return colours[colour.toLowerCase()];

	return false;
}
function rgb2hex(rgb){
	rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
	return (rgb && rgb.length === 4) ? "#" +
		("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
		("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
		("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
}

function convertBase(value, from_base, to_base) {
	var range = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/'.split('');
	var from_range = range.slice(0, from_base);
	var to_range = range.slice(0, to_base);

	var dec_value = value.split('').reverse().reduce(function (carry, digit, index) {
		if (from_range.indexOf(digit) === -1) throw new Error('Invalid digit `'+digit+'` for base '+from_base+'.');
		return carry += from_range.indexOf(digit) * (Math.pow(from_base, index));
	}, 0);

	var new_value = '';
	while (dec_value > 0) {
		new_value = to_range[dec_value % to_base] + new_value;
		dec_value = (dec_value - (dec_value % to_base)) / to_base;
	}
	return new_value || '0';
}

function dataParse( data ) {
	if(!data)
		return {};
	var result = {};
	if(typeof data === 'string') {
		var arr = data.split('|');
		for(var i=0; i<arr.length; i++) {
			var temp = arr[i].split(' ');
			result[temp.shift()] = decodeURIComponent(temp.join(' '));
		}
	} else if(typeof data === 'object') {
		result = data;
	}


	return result;
}

function isEmpty(obj) {
	for(var prop in obj) {
		if(obj.hasOwnProperty(prop))
			return false;
	}

	return JSONStringify(obj) === JSONStringify({});
}

function JSONStringify (obj) {
	if(typeof JSON === 'object' && JSON.stringify)
		return JSON.stringify(obj);

	var t = typeof (obj);
	if (t != "object" || obj === null) {

		// simple data type
		if (t == "string") obj = '"'+obj.replace('\\', '\\\\').replace('"', '\\"')+'"';
		return String(obj);

	}
	else {

		// recurse array or object
		var n, v, json = [], arr = (obj && obj.constructor == Array);

		for (n in obj) {
			v = obj[n]; t = typeof(v);

			if (t == "string") v = '"'+v.replace('\\', '\\\\').replace('"', '\\"')+'"';
			else if (t == "object" && v !== null) v = JSONStringify(v);

			json.push((arr ? "" : '"' + n.replace('\\', '\\\\').replace('"', '\\"') + '":') + String(v));
		}

		return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
	}
};

function JSONParse ( string ) {
	try
	{
		if (typeof JSON === 'object' && JSON.parse) {
			return JSON.parse(string);
		}
		return eval('('+string+')');
	}
	catch (e)
	{	
		throw "json parsing error";
	}
}

function setCookie(cname, cvalue, exdays) {
	var d = new Date();
	d.setTime(d.getTime() + (exdays*24*60*60*1000));
	var expires = "expires="+d.toUTCString();
	document.cookie = cname + "=" + cvalue + "; path=/; " + expires;
}

function getCookie(cname) {
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for(var i=0; i<ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1);
		if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
	}
	return undefined;
}

function deleteCookie( name, path, domain ) {
  if( getCookie( name ) ) {
    document.cookie = name + "=" +
      ((path) ? ";path="+path:"")+
      ((domain)?";domain="+domain:"") +
      ";expires=Thu, 01 Jan 1970 00:00:01 GMT";
  }
}

/* 임시 함수asdasd	*/
String.prototype.hexDecode = function(){
	var j;
	var hexes = this.match(/.{1,4}/g) || [];
	var back = "";
	for(j = 0; j<hexes.length; j++) {
	    back += String.fromCharCode(parseInt(hexes[j], 16));
	}

	return back;
}
String.prototype.hexEncode = function(){
	var hex, i;

	var result = "";
	for (i=0; i<this.length; i++) {
		hex = this.charCodeAt(i).toString(16);
		result += ("000"+hex).slice(-2);
	}

	return result
}
if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(search, pos) {
		return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
	};
}
function getQueryParams(qs) {
	qs = qs.split('+').join(' ');

	var params = {},
		tokens,
		re = /[?&]?([^=]+)=([^&]*)/g;

	while (tokens = re.exec(qs)) {
		try{
			params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
		} catch(e) {}
	}

	return params;
}

if(query['uchatdebug'] == 1 || debug) {
	debug = 1;
	var logger = document.createElement('div');
	logger.id = "uchatLog";
	document.getElementsByTagName('body')[0] && document.getElementsByTagName('body')[0].appendChild(logger);
}

/* 임시 함수   */
})(window, document, undefined);
