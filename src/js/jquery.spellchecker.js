/*
 * jQuery Spellchecker
 * https://github.com/badsyntax/jquery-spellchecker
 *
 * Copyright (c) 2012 Richard Willis (http://badsyntax.co)
 * Licensed under the MIT license.
 */

(function($){

  /* Config
   *************************/

  var defaultConfig = {
    lang: 'en',
    engine: {
      path: 'spellchecker.php',
      driver: 'PSpell'
    },
    local: {
      requestError: 'There was an error processing the request.',
      ignoreWord: 'Ignore word',
      ignoreAll: 'Ignore all',
      ignoreForever: 'Add to dictionary',
      loading: 'Loading...'
    },
    suggestBox: {
      numWords: 5,
      position: 'above',
      offset: 2
    },
    incorrectWords: {
      container: 'body' //selector
    }
  };

  var pluginName = 'spellchecker';

  /* Util
   *************************/

  if (!Function.prototype.bind) {
    Function.prototype.bind = function(scope) {
      return $.proxy(this, scope);
    };
  }

  var inherits = function(_sub, _super) {
    function F() {}
    F.prototype = _super.prototype;
    _sub.prototype = new F();
    _sub.prototype.constructor = _sub;
  };

  /* Events
   *************************/

  var Events = function(){
    this._handlers = {};
  };

  Events.prototype = {
    on: function(name, handler) {
      if (!this._handlers[name]) {
        this._handlers[name] = $.Callbacks();
      }
      this._handlers[name].add(handler);
    },
    trigger: function(name) {
      if (this._handlers[name]) {
        var args = Array.prototype.slice.call(arguments, 1);
        this._handlers[name].fireWith(this, args);
      }
    },
    handler: function(name) {
      return function(e) {
        this.trigger(name, e);
      }.bind(this);
    }
  };

  /* Base box
   *************************/

  var Box = function(config) {
    Events.call(this);
    this.config = config;
    this.createBox();
    this.bindEvents();
  };
  inherits(Box, Events);

  Box.prototype.onSelectWord = function(e) {

    e.stopPropagation();

    var element = $(e.currentTarget);
    var word = $.trim(element.text());

    this.trigger('select.word', e, word, element);
  };

  /* Incorrect words box
   *************************/

  var IncorrectWordsBox = function(config) {
    Box.apply(this, arguments);
  };
  inherits(IncorrectWordsBox, Box);

  IncorrectWordsBox.prototype.bindEvents = function() {
    this.container.on('click', 'a', this.onSelectWord.bind(this));
  };

  IncorrectWordsBox.prototype.createBox = function() {
    this.container = $([
      '<div class="' + pluginName + '-incorrectwords">',
      '</div>'
    ].join('')).appendTo(this.config.incorrectWords.container);
  };

  IncorrectWordsBox.prototype.addWords = function(words) {

    // Make array values unique
    words = $.grep(words, function(el, index){
        return index == $.inArray(el, words);
    });

    var html = $.map(words, function(word) {
      return '<a href="#">' + word + '</a>';
    }).join('');

    this.container.html(html).show();
  };

  IncorrectWordsBox.prototype.loading = function(show) {
    this.container.html(show ? this.config.local.loading : '');
  };

  /* Incorrect words inline
   *************************/

  var IncorrectWordsInline = function(config, parser, element) {
    Events.call(this);
    this.config = config;
    this.parser = parser;
    this.element = element;
    this.bindEvents();
  };
  inherits(IncorrectWordsInline, Events);

  IncorrectWordsInline.prototype.bindEvents = function() {
    this.element.on('click', '.' + pluginName + '-word-highlight', this.onSelectWord.bind(this));
  };

  IncorrectWordsInline.prototype.addWords = function(words) {
    var highlighted = this.parser.highlightWords(words);
    this.element.html(highlighted);
  };

  IncorrectWordsInline.prototype.loading = function() {};

  IncorrectWordsInline.prototype.onSelectWord = function(e) {

    e.preventDefault();
    e.stopPropagation();

    var element = $(e.currentTarget);
    var word = $.trim(element.data('word'));

    this.trigger('select.word', e, word, element);
  };

  /* Suggest box
   *************************/

  var SuggestBox = function(config, element) {
    this.element = element;
    this.body = this.element[0].nodeName === 'BODY' ? this.element : 'body';
    Box.apply(this, arguments);
  };
  inherits(SuggestBox, Box);

  SuggestBox.prototype.bindEvents = function() {
    var click = 'click.' + pluginName;
    this.container.on(click, this.onContainerClick.bind(this));
    this.container.on(click, '.ignore-word', this.handler('ignore.word'));
    this.container.on(click, '.ignore-all', this.handler('ignore.all'));
    this.container.on(click, '.ignore-forever', this.handler('ignore.forever'));
    this.container.on(click, '.words a', this.onSelectWord.bind(this));
    $('html').on(click, this.onWindowClick.bind(this));
    if (this.element[0].nodeName === 'BODY') {
      this.element.parent().on(click, this.onWindowClick.bind(this));
    }
  };

  SuggestBox.prototype.createBox = function() {

    var local = this.config.local;

    this.container = $([
      '<div class="' + pluginName + '-suggestbox">',
      ' <div class="footer">',
      '   <a href="#" class="ignore-word">' + local.ignoreWord + '</a>',
      '   <a href="#" class="ignore-all">' + local.ignoreAll + '</a>',
      '   <a href="#" class="ignore-forever">' + local.ignoreForever + '</a>',
      ' </div>',
      '</div>'
    ].join('')).appendTo(this.body);

    this.words = $([
      '<div class="words">',
      '</div>'
    ].join('')).prependTo(this.container);

    this.loadingMsg = $([
      '<div class="loading">',
      this.config.local.loading,
      '</div>'
    ].join(''));

    this.footer = this.container.find('.footer').hide();
  };

  SuggestBox.prototype.addWords = function(words) {

    var html = $.map(words, function(word) {
      return '<a href="#">' + word + '</a>';
    }).slice(0, this.config.suggestBox.numWords).join('');

    if (!html) {
      html = '<em>(No suggestions)</em>';
    }

    this.words.html(html);
  };

  SuggestBox.prototype.loadSuggestedWords = function(getWords, word, wordElement) {

    this.wordElement = $(wordElement);
    this.loading(true);

    getWords(word, this.onGetWords.bind(this));
  };

  SuggestBox.prototype.loading = function(show) {
    this.footer.hide();
    this.open();
    this.words.html(show ? this.loadingMsg : '');
    this.position();
  };

  SuggestBox.prototype.position = function() {

    var win = $(window);
    var element = this.wordElement.data('firstElement') || this.wordElement;
    var offset = element.offset();
    var boxOffset = this.config.suggestBox.offset;
    var containerHeight = this.container.outerHeight();

    var positionAbove = (offset.top - containerHeight - boxOffset);
    var positionBelow = (offset.top + element.outerHeight() + boxOffset);

    var left = offset.left;
    var top;

    if (this.config.suggestBox.position === 'below') {
      top = positionBelow;
      if (win.height() + win.scrollTop() < positionBelow + containerHeight) {
        top = positionAbove;
      }
    } else {
      top = positionAbove;
    }

    this.container.css({ top: top, left: left });
  };

  SuggestBox.prototype.open = function() {
    this.position();
    this.container.fadeIn(180);
  };

  SuggestBox.prototype.close = function() {
    this.container.fadeOut(100, function(){
      this.footer.hide();
    }.bind(this));
  };

  SuggestBox.prototype.detach = function() {
    this.container = this.container.detach();
  };

  SuggestBox.prototype.reattach = function() {
    this.container.appendTo(this.body);
  };

  SuggestBox.prototype.onGetWords = function(words) {
    this.loading(false);
    this.addWords(words);
    this.footer.show();
    this.position();
  };

  SuggestBox.prototype.onContainerClick = function(e) {
    e.stopPropagation();
  };

  SuggestBox.prototype.onWindowClick = function(e) {
    this.close();
  };

  /* Spellchecker engine
   *************************/

  var Engine = function(config) {

    this.config = config;

    this.defaultConfig = {
      url: config.engine.path,
      type: 'POST',
      dataType: 'json',
      cache: false,
      data: {
        lang: config.lang,
        driver: config.engine.driver
      },
      error: function() {
        alert(config.local.requestError);
      }.bind(this)
    };
  };

  Engine.prototype.makeRequest = function(config) {

    var defaultConfig = $.extend(true, {}, this.defaultConfig);

    return $.ajax($.extend(true, defaultConfig, config));
  };

  Engine.prototype.checkWords = function(text, callback) {
    return this.makeRequest({
      data: {
        action: 'get_incorrect_words',
        text: text
      },
      success: callback
    });
  };

  Engine.prototype.getSuggestedWords = function(word, callback) {
    return this.makeRequest({
      data: {
        action: 'get_suggestions',
        word: word
      },
      success: callback
    });
  };

  /* Spellchecker base parser
   *************************/

  var Parser = function(element) {
    this.element = element;
  };

  Parser.prototype.clean = function(text) {

    var tagExpression = '<[^>]+>';
    var punctuationExpression = '^[^a-zA-Z\\u00A1-\\uFFFF]|[^a-zA-Z\\u00A1-\\uFFFF]+[^a-zA-Z\\u00A1-\\uFFFF]|[^a-zA-Z\\u00A1-\\uFFFF]$|\\n|\\t|\\s{2,}';

    text = text.replace(new RegExp(tagExpression, 'g'), ''); // strip any html tags
    text = text.replace(new RegExp(punctuationExpression, 'g'), ' '); // strip any punctuation

    return $.trim(text);
  };

  /* Spellchecker text parser
   *************************/

  var TextParser = function() {
    Parser.apply(this, arguments);
  };
  inherits(TextParser, Parser);

  TextParser.prototype.getText = function() {
    return this.clean(this.element.val());
  };

  TextParser.prototype.replaceWordInText = function(text, oldWord, newWord) {
    return text
      .replace(
        new RegExp("([^a-zA-Z\\u00A1-\\uFFFF]?)(" + oldWord + ")([^a-zA-Z\\u00A1-\\uFFFF]?)", "g"),
        '$1' + newWord + '$3'
      )
      .replace(
        new RegExp("^(" + oldWord + ")([^a-zA-Z\\u00A1-\\uFFFF])", "g"),
        newWord + '$2'
      )
      .replace(
        new RegExp("([^a-zA-Z\\u00A1-\\uFFFF])(" + oldWord + ")$", "g"),
        '$1' + newWord
      );
  };

  TextParser.prototype.replaceWord = function(oldWord, replacement) {

    var oldText = this.element.val();
    var newText = this.replaceWordInText(oldText, oldWord, replacement);

    this.element.val(newText);
  };

  /* Spellchecker html parser
   *************************/

  var HtmlParser = function() {
    Parser.apply(this, arguments);
  };
  inherits(HtmlParser, Parser);

  HtmlParser.prototype.getText = function() {

    var element = this.element
      .clone()
      .find('[class^="spellchecker-"]')
      .remove()
      .end();

    var text = this.element.text();

    return this.clean(text);
  };

  HtmlParser.prototype.replaceText = function(regExp, replaceText) {
    findAndReplaceDOMText(regExp, this.element[0], replaceText);
  };

  HtmlParser.prototype.replaceWord = function(oldWord, replacement) {

    findAndReplaceDOMText.revert();

    var r = replacement;
    var replaced;
    var replaceFill;
    var c;
    var regExp = new RegExp('\\b' + oldWord + '\\b', 'g');

    this.replaceText(regExp, function(fill, i){

      // Reset the replacement for each match
      if (i !== c) {
        c = i;
        replacement = r;
        replaced = '';
      }

      replaceFill = replacement.substring(0, fill.length);
      replacement = replacement.substring(fill.length);
      replaced += fill;

      // Add remaining text to last node
      if (replaced === oldWord && replacement.length > 0) {
        replaceFill += replacement;
      }

      return document.createTextNode(replaceFill || '');
    });

    // Remove this word from the list of incorrect words
    this.incorrectWords = $.map(this.incorrectWords, function(word) {
      return word === oldWord ? null : word;
    });

    this.highlightWords(this.incorrectWords);
  };

  HtmlParser.prototype.highlightWords = function(incorrectWords) {

    if (!incorrectWords.length) {
      return;
    }

    this.incorrectWords = incorrectWords;

    var regExp = new RegExp('\\b' + incorrectWords.join('|') + '\\b', 'g');
    var c;
    var replaceElement;

    this.replaceText(regExp, function(fill, i) {

      // Replacement node
      var span = $('<span />', {
        'class': pluginName + '-word-highlight',
        'data-word': incorrectWords[i]
      });

      span.text(fill);

      // If we have a new match
      if (i !== c) {
        c = 0;
        replaceElement = span;
      }

      // We save the first replacement element so we
      // can position the suggest box correctly.
      span.data('firstElement', replaceElement);

      return span[0];
    });
  };

  /* Spellchecker
   *************************/

  var SpellChecker = function(element, config) {

    Events.call(this);

    this.element = $(element).attr('spellcheck', 'false');
    this.config = $.extend(true, defaultConfig, config);

    this.setupEngine();
    this.setupParser();
    this.setupSuggestBox();
    this.setupIncorrectWords();
    this.bindEvents();
  };
  inherits(SpellChecker, Events);

  SpellChecker.prototype.setupEngine = function() {
    this.engine = new Engine(this.config);
  };

  SpellChecker.prototype.setupSuggestBox = function() {
    this.suggestBox = new SuggestBox(this.config, this.element);
  };

  SpellChecker.prototype.setupIncorrectWords = function() {
    this.incorrectWords = this.config.parser === 'html'
      ? new IncorrectWordsInline(this.config, this.parser, this.element)
      : new IncorrectWordsBox(this.config, this.parser, this.element);
  };

  SpellChecker.prototype.setupParser = function() {
    this.parser = this.config.parser === 'html'
      ? new HtmlParser(this.element)
      : new TextParser(this.element);
  };

  SpellChecker.prototype.bindEvents = function() {
    this.on('check.fail', this.onCheckFail.bind(this));
    this.suggestBox.on('ignore.word', this.onIgnoreWord.bind(this));
    this.suggestBox.on('ignore.all', this.onIgnoreAll.bind(this));
    this.suggestBox.on('ignore.forever', this.onIgnoreForever.bind(this));
    this.suggestBox.on('select.word', this.onSuggestedWordSelect.bind(this));
    this.incorrectWords.on('select.word', this.onIncorrectWordSelect.bind(this));
  };

  /* Pubic API methods */

  SpellChecker.prototype.check = function() {
    this.incorrectWords.loading(true);
    var text = this.parser.getText();
    this.engine.checkWords(text, this.onCheckWords.bind(this));
  };

  SpellChecker.prototype.showSuggestedWords = function(word, element) {
    var getWords = this.engine.getSuggestedWords.bind(this.engine);
    this.suggestBox.loadSuggestedWords(getWords, word, element);
  };

  /* Event handlers */

  SpellChecker.prototype.onCheckWords = function(data) {

    this.incorrectWords.loading(false);

    var badWords = data.data;
    var outcome = badWords.length ? 'fail' : 'success';

    this.trigger('check.' + outcome, badWords);
  };

  SpellChecker.prototype.onCheckFail = function(badWords) {
    this.suggestBox.detach();
    this.incorrectWords.addWords(badWords);
    this.suggestBox.reattach();
  };

  SpellChecker.prototype.onSuggestedWordSelect = function(e, word, element) {
    e.preventDefault();
    this.suggestBox.close();
    this.suggestBox.detach();
    this.parser.replaceWord(this.incorrectWord, word);
    this.suggestBox.reattach();
    // this.incorrectWordElement.remove();
  };

  SpellChecker.prototype.onIgnoreWord = function() {
    alert('Ignore word');
  };

  SpellChecker.prototype.onIgnoreAll = function() {
    alert('Ignore all');
  };

  SpellChecker.prototype.onIgnoreForever = function() {
    alert('Ignore forever');
  };

  SpellChecker.prototype.onIncorrectWordSelect = function(e, word, element) {
    e.preventDefault();
    this.incorrectWord = word;
    this.incorrectWordElement = element;
    this.showSuggestedWords(word, element);
  };

  $.SpellChecker = SpellChecker;

}(jQuery));

/**
 * findAndReplaceDOMText v 0.11
 * @author James Padolsey http://james.padolsey.com
 * @license http://unlicense.org/UNLICENSE
 *
 * Matches the text of a DOM node against a regular expression
 * and replaces each match (or node-separated portions of the match)
 * in the specified element.
 */
window.findAndReplaceDOMText=function(){function e(e,r,s){var o,u,a=[],f=t(r),l=i(s);if(!f)return;if(e.global)while(o=e.exec(f)){if(!o[0])throw"findAndReplaceDOMText cannot handle zero-length matches";a.push([e.lastIndex-o[0].length,e.lastIndex,o])}else{o=f.match(e),u=f.indexOf(o[0]);if(!o[0])throw"findAndReplaceDOMText cannot handle zero-length matches";a.push([u,u+o[0].length,o])}a.length&&n(r,a,l)}function t(e){if(e.nodeType===3)return e.data;var n="";if(e=e.firstChild)do n+=t(e);while(e=e.nextSibling);return n}function n(e,t,n){var r,i,s,o,u,a,f=[],l=0,c=e,h=t.shift(),p=0;e:for(;;){c.nodeType===3&&(!o&&c.length+l>=h[1]?(o=c,a=h[1]-l):s&&f.push(c),!s&&c.length+l>h[0]&&(s=c,u=h[0]-l),l+=c.length);if(s&&o){c=n({startNode:s,startNodeIndex:u,endNode:o,endNodeIndex:a,innerNodes:f,match:h[2],matchIndex:p}),l-=o.length-a,s=null,o=null,f=[],h=t.shift(),p++;if(!h)break}else if(c.firstChild||c.nextSibling){c=c.firstChild||c.nextSibling;continue}for(;;){if(c.nextSibling){c=c.nextSibling;break}if(c.parentNode===e)break e;c=c.parentNode}}}function i(e){r=[];var t;if(typeof e!="function"){var n=e.nodeType?e:document.createElement(e);t=function(e){var t=document.createElement("div"),r;return t.innerHTML=n.outerHTML||(new XMLSerializer).serializeToString(n),r=t.firstChild,e&&r.appendChild(document.createTextNode(e)),r}}else t=e;return function(n){var i=n.startNode,s=n.endNode,o=n.matchIndex;if(i===s){var u=i;if(n.startNodeIndex>0){var a=document.createTextNode(u.data.substring(0,n.startNodeIndex));u.parentNode.insertBefore(a,u)}var f=t(n.match[0],o);u.parentNode.insertBefore(f,u);if(n.endNodeIndex<u.length){var l=document.createTextNode(u.data.substring(n.endNodeIndex));u.parentNode.insertBefore(l,u)}return u.parentNode.removeChild(u),r.push(function(){var e=f.parentNode;e.insertBefore(f.firstChild,f),e.removeChild(f),e.normalize()}),f}var a=document.createTextNode(i.data.substring(0,n.startNodeIndex)),l=document.createTextNode(s.data.substring(n.endNodeIndex)),c=t(i.data.substring(n.startNodeIndex),o),h=[];for(var p=0,d=n.innerNodes.length;p<d;++p){var v=n.innerNodes[p],m=t(v.data,o);v.parentNode.replaceChild(m,v),h.push(m)}var g=t(s.data.substring(0,n.endNodeIndex),o);return i.parentNode.insertBefore(a,i),i.parentNode.insertBefore(c,i),i.parentNode.removeChild(i),s.parentNode.insertBefore(g,s),s.parentNode.insertBefore(l,s),s.parentNode.removeChild(s),r.push(function(){h.unshift(c),h.push(g);for(var e=0,t=h.length;e<t;++e){var n=h[e],r=n.parentNode;r.insertBefore(n.firstChild,n),r.removeChild(n),r.normalize()}}),g}}var r;return e.revert=function(){for(var t=0,n=r.length;t<n;++t)r[t]();r=[]},e}()