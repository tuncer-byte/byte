/* PrismJS - Basitleştirilmiş kod vurgulama kütüphanesi */
(function(){
    var Prism = (function(){
        var lang = /\blang(?:uage)?-([\w-]+)\b/i;
        var uniqueId = 0;
        
        var _ = {
            manual: true,
            disableWorkerMessageHandler: true,
            util: {
                encode: function encode(tokens) {
                    if (tokens instanceof Token) {
                        return new Token(tokens.type, encode(tokens.content), tokens.alias);
                    } else if (Array.isArray(tokens)) {
                        return tokens.map(encode);
                    } else {
                        return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
                    }
                },
                type: function (o) {
                    return Object.prototype.toString.call(o).slice(8, -1);
                },
                stringify: function stringify(o, language) {
                    if (typeof o == 'string') {
                        return o;
                    }
                    if (Array.isArray(o)) {
                        var s = '';
                        o.forEach(function (e) {
                            s += stringify(e, language);
                        });
                        return s;
                    }
                    
                    var env = {
                        type: o.type,
                        content: stringify(o.content, language),
                        tag: 'span',
                        classes: ['token', o.type],
                        attributes: {},
                        language: language
                    };
                    
                    if (o.alias) {
                        var aliases = Array.isArray(o.alias) ? o.alias : [o.alias];
                        Array.prototype.push.apply(env.classes, aliases);
                    }
                    
                    var attributes = '';
                    for (var name in env.attributes) {
                        attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
                    }
                    
                    return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
                }
            },
            languages: {
                extend: function (id, redef) {
                    var lang = _.util.clone(_.languages[id]);
                    
                    for (var key in redef) {
                        lang[key] = redef[key];
                    }
                    
                    return lang;
                },
                insertBefore: function (inside, before, insert, root) {
                    root = root || _.languages;
                    var grammar = root[inside];
                    var ret = {};
                    
                    for (var token in grammar) {
                        if (grammar.hasOwnProperty(token)) {
                            if (token == before) {
                                for (var newToken in insert) {
                                    if (insert.hasOwnProperty(newToken)) {
                                        ret[newToken] = insert[newToken];
                                    }
                                }
                            }
                            
                            if (!insert.hasOwnProperty(token)) {
                                ret[token] = grammar[token];
                            }
                        }
                    }
                    
                    var old = root[inside];
                    root[inside] = ret;
                    
                    // Update references in other language definitions
                    _.languages.DFS(_.languages, function(key, value) {
                        if (value === old && key != inside) {
                            this[key] = ret;
                        }
                    });
                    
                    return ret;
                },
                DFS: function DFS(o, callback, type, visited) {
                    visited = visited || {};
                    
                    var objId = _.util.objId;
                    
                    for (var i in o) {
                        if (o.hasOwnProperty(i)) {
                            callback.call(o, i, o[i], type || i);
                            
                            var property = o[i],
                                propertyType = _.util.type(property);
                            
                            if (propertyType === 'Object' && !visited[objId(property)]) {
                                visited[objId(property)] = true;
                                DFS(property, callback, null, visited);
                            }
                            else if (propertyType === 'Array' && !visited[objId(property)]) {
                                visited[objId(property)] = true;
                                DFS(property, callback, i, visited);
                            }
                        }
                    }
                }
            },
            plugins: {},
            highlight: function (text, grammar, language) {
                var env = {
                    code: text,
                    grammar: grammar,
                    language: language
                };
                _.hooks.run('before-tokenize', env);
                env.tokens = _.tokenize(env.code, env.grammar);
                _.hooks.run('after-tokenize', env);
                return Token.stringify(_.util.encode(env.tokens), env.language);
            },
            tokenize: function(text, grammar) {
                var rest = grammar.rest;
                if (rest) {
                    for (var token in rest) {
                        grammar[token] = rest[token];
                    }
                    delete grammar.rest;
                }
                
                var tokenList = new LinkedList();
                addAfter(tokenList, tokenList.head, text);
                
                matchGrammar(text, tokenList, grammar, tokenList.head, 0);
                
                return toArray(tokenList);
            },
            hooks: {
                all: {},
                add: function (name, callback) {
                    var hooks = _.hooks.all;
                    hooks[name] = hooks[name] || [];
                    hooks[name].push(callback);
                },
                run: function (name, env) {
                    var callbacks = _.hooks.all[name];
                    if (!callbacks || !callbacks.length) {
                        return;
                    }
                    for (var i=0, callback; callback = callbacks[i++];) {
                        callback(env);
                    }
                }
            },
            Token: Token
        };
        
        function Token(type, content, alias, matchedStr, greedy) {
            this.type = type;
            this.content = content;
            this.alias = alias;
            this.length = (matchedStr || '').length | 0;
            this.greedy = !!greedy;
        }
        
        Token.stringify = function stringify(o, language) {
            if (typeof o == 'string') {
                return o;
            }
            if (Array.isArray(o)) {
                var s = '';
                o.forEach(function (e) {
                    s += stringify(e, language);
                });
                return s;
            }
            
            var env = {
                type: o.type,
                content: stringify(o.content, language),
                tag: 'span',
                classes: ['token', o.type],
                attributes: {},
                language: language
            };
            
            if (o.alias) {
                var aliases = Array.isArray(o.alias) ? o.alias : [o.alias];
                Array.prototype.push.apply(env.classes, aliases);
            }
            
            var attributes = '';
            for (var name in env.attributes) {
                attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
            }
            
            return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
        };
        
        function matchPattern(pattern, pos, text, lookbehind) {
            pattern.lastIndex = pos;
            var match = pattern.exec(text);
            if (match && lookbehind && match[1]) {
                var lookbehindLength = match[1].length;
                match.index += lookbehindLength;
                match[0] = match[0].slice(lookbehindLength);
            }
            return match;
        }
        
        function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
            for (var token in grammar) {
                if (!grammar.hasOwnProperty(token) || !grammar[token]) {
                    continue;
                }
                
                var patterns = grammar[token];
                patterns = Array.isArray(patterns) ? patterns : [patterns];
                
                for (var j = 0; j < patterns.length; ++j) {
                    if (rematch && rematch.cause == token + ',' + j) {
                        return;
                    }
                    
                    var patternObj = patterns[j],
                        inside = patternObj.inside,
                        lookbehind = !!patternObj.lookbehind,
                        greedy = !!patternObj.greedy,
                        alias = patternObj.alias;
                    
                    if (greedy && !patternObj.pattern.global) {
                        var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
                        patternObj.pattern = RegExp(patternObj.pattern.source, flags + 'g');
                    }
                    
                    var pattern = patternObj.pattern || patternObj;
                    
                    for (
                        var currentNode = startNode.next, pos = startPos;
                        currentNode !== tokenList.tail;
                        pos += currentNode.value.length, currentNode = currentNode.next
                    ) {
                        var str = currentNode.value;
                        
                        if (tokenList.length > text.length) {
                            return;
                        }
                        
                        if (str instanceof Token) {
                            continue;
                        }
                        
                        var removeCount = 1;
                        var match;
                        
                        if (greedy) {
                            match = matchPattern(pattern, pos, text, lookbehind);
                            if (!match) {
                                break;
                            }
                            
                            var from = match.index;
                            var to = match.index + match[0].length;
                            var p = pos;
                            
                            p += currentNode.value.length;
                            
                            while (from >= p) {
                                currentNode = currentNode.next;
                                p += currentNode.value.length;
                            }
                            
                            p -= currentNode.value.length;
                            pos = p;
                            
                            if (currentNode.value instanceof Token) {
                                continue;
                            }
                            
                            for (
                                var k = currentNode;
                                k !== tokenList.tail && (p < to || (typeof k.value === 'string'));
                                k = k.next
                            ) {
                                removeCount++;
                                p += k.value.length;
                            }
                            removeCount--;
                            
                            str = text.slice(pos, p);
                            match.index -= pos;
                        } else {
                            match = matchPattern(pattern, 0, str, lookbehind);
                            if (!match) {
                                continue;
                            }
                        }
                        
                        var from = match.index,
                            matchStr = match[0],
                            before = str.slice(0, from),
                            after = str.slice(from + matchStr.length);
                        
                        var reach = pos + str.length;
                        if (rematch && reach > rematch.reach) {
                            rematch.reach = reach;
                        }
                        
                        var removeFrom = currentNode.prev;
                        
                        if (before) {
                            removeFrom = addAfter(tokenList, removeFrom, before);
                            pos += before.length;
                        }
                        
                        removeRange(tokenList, removeFrom, removeCount);
                        
                        var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr, greedy);
                        currentNode = addAfter(tokenList, removeFrom, wrapped);
                        
                        if (after) {
                            addAfter(tokenList, currentNode, after);
                        }
                        
                        if (removeCount > 1)
                            matchGrammar(text, tokenList, grammar, currentNode.prev, pos, {
                                cause: token + ',' + j,
                                reach: reach
                            });
                    }
                }
            }
        }
        
        function LinkedList() {
            var head = { value: null, prev: null, next: null };
            var tail = { value: null, prev: head, next: null };
            head.next = tail;
            
            this.head = head;
            this.tail = tail;
            this.length = 0;
        }
        
        function addAfter(list, node, value) {
            var next = node.next;
            
            var newNode = { value: value, prev: node, next: next };
            node.next = newNode;
            next.prev = newNode;
            list.length++;
            
            return newNode;
        }
        
        function removeRange(list, node, count) {
            var next = node.next;
            for (var i = 0; i < count && next !== list.tail; i++) {
                next = next.next;
            }
            node.next = next;
            next.prev = node;
            list.length -= i;
        }
        
        function toArray(list) {
            var array = [];
            var node = list.head.next;
            while (node !== list.tail) {
                array.push(node.value);
                node = node.next;
            }
            return array;
        }
        
        // Dillerin temel tanımlarını ekle
        _.languages.markup = {
            'comment': /<!--[\s\S]*?-->/,
            'prolog': /<\?[\s\S]+?\?>/,
            'doctype': {
                pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:(?!<!--)[^"'\]]|"[^"]*"|'[^']*'|<!--[\s\S]*?-->)*\]\s*)?>/i,
                greedy: true
            },
            'tag': {
                pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/i,
                greedy: true,
                inside: {
                    'tag': {
                        pattern: /^<\/?[^\s>\/]+/i,
                        inside: {
                            'punctuation': /^<\/?/,
                            'namespace': /^[^\s>\/:]+:/
                        }
                    },
                    'attr-value': {
                        pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/i,
                        inside: {
                            'punctuation': [
                                /^=/,
                                {
                                    pattern: /^(\s*)["']|["']$/,
                                    lookbehind: true
                                }
                            ]
                        }
                    },
                    'punctuation': /\/?>/,
                    'attr-name': {
                        pattern: /[^\s>\/]+/,
                        inside: {
                            'namespace': /^[^\s>\/:]+:/
                        }
                    }
                }
            },
            'entity': /&#?[\da-z]{1,8};/i
        };
        
        _.languages.javascript = {
            'comment': [
                {
                    pattern: /\/\/.*$/m,
                    greedy: true
                },
                {
                    pattern: /\/\*[\s\S]*?(?:\*\/|$)/,
                    greedy: true
                }
            ],
            'string': {
                pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
                greedy: true
            },
            'keyword': /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
            'boolean': /\b(?:true|false)\b/,
            'number': /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
            'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
            'punctuation': /[{}[\];(),.:]/
        };
        
        _.languages.css = {
            'comment': /\/\*[\s\S]*?\*\//,
            'atrule': {
                pattern: /@[\w-]+[\s\S]*?(?:;|(?=\s*\{))/,
                inside: {
                    'rule': /@[\w-]+/
                }
            },
            'url': {
                pattern: /url\((?:(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|[\s\S]*?)\)/i,
                inside: {
                    'function': /^url/i,
                    'punctuation': /^\(|\)$/,
                    'string': {
                        pattern: /^(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1$/,
                        greedy: true
                    }
                }
            },
            'selector': {
                pattern: /(?:^|[{}[\];(),.:@])(?:[^{}[\];(),.:@"'`\s]|\s+)(?:[^{}[\];(),.:@"'`\s]|\s+)+(?=\s*\{)/,
                lookbehind: true
            },
            'string': {
                pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
                greedy: true
            },
            'property': {
                pattern: /[-_a-z\xA0-\uFFFF][-\w\xA0-\uFFFF]*(?=\s*:)/i,
                inside: {
                    'definition': /.+/
                }
            },
            'important': /!important\b/i,
            'function': /[-a-z0-9]+(?=\()/i,
            'punctuation': /[(){};:,]/
        };
        
        // En çok kullanılan dilleri ekle
        _.languages.python = {
            'comment': {
                pattern: /(^|[^\\])#.*/,
                lookbehind: true
            },
            'string': {
                pattern: /(?:'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^\\'\r\n])*'|"(?:\\.|[^\\"\r\n])*")/,
                greedy: true
            },
            'keyword': /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
            'builtin': /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
            'boolean': /\b(?:True|False|None)\b/,
            'number': /(?:\b(?=\d)|\B(?=\.))(?:0[bo])?(?:(?:\d|0x[\da-f])[\da-f]*\.?\d*|\.\d+)(?:e[+-]?\d+)?j?\b/i,
            'operator': /[-+%=]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
            'punctuation': /[{}[\];(),.:]/
        };
        
        _.languages.typescript = _.languages.extend('javascript', {
            'keyword': /\b(?:abstract|as|async|await|break|case|catch|class|const|constructor|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|is|keyof|let|module|namespace|new|null|of|package|private|protected|public|readonly|return|require|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield)\b/,
            'builtin': /\b(?:string|Function|any|number|boolean|Array|symbol|console|Promise|unknown|never)\b/
        });
        
        _.languages.csharp = _.languages.extend('javascript', {
            'keyword': /\b(?:abstract|as|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|ref|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|virtual|void|volatile|while|add|alias|ascending|async|await|descending|dynamic|from|get|global|group|into|join|let|orderby|partial|remove|select|set|value|var|where|yield)\b/,
            'string': [
                {
                    pattern: /@("|')(?:\1\1|\\[\s\S]|(?!\1)[^\\])*\1/,
                    greedy: true
                },
                {
                    pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*?\1/,
                    greedy: true
                }
            ],
            'number': /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i
        });
        
        _.languages.plaintext = {};
        
        // Temel fonksiyonları oluştur
        function highlightElement(element) {
            _.hooks.run('before-highlight', { element: element });
            
            var language = element.className.match(lang) || [,'plaintext'];
            
            var code = element.textContent;
            var grammar = _.languages[language[1]];
            
            if (!grammar) return;
            
            element.innerHTML = _.highlight(code, grammar, language[1]);
        }
        
        function highlightAll() {
            var elements = document.querySelectorAll('code[class*="language-"], [class*="language-"] code');
            for (var i=0, element; element = elements[i++];) {
                highlightElement(element);
            }
        }
        
        // Prism nesnesini expose et
        var Prism = {
            highlight: function(text, grammar, language) {
                return _.highlight(text, grammar, language);
            },
            highlightElement: highlightElement,
            highlightAll: highlightAll,
            languages: _.languages
        };
        
        return Prism;
    })();
    
    // Global olarak tanımla
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Prism;
    }
    
    if (typeof global !== 'undefined') {
        global.Prism = Prism;
    }
    
    if (typeof window !== 'undefined') {
        window.Prism = Prism;
    }
    
    // Sayfa yüklendikten sonra çalıştır
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', function() {
            if (window.Prism) {
                window.Prism.highlightAll();
            }
        });
    }
})(); 