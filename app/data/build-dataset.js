"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAll = fetchAll;
var process_1 = require("process");
//--------------------------------------------------
// 1. JLPT Vocabulary API 래퍼 (모든 페이지 수집)
//--------------------------------------------------
var JLPT_API = 'https://jlpt-vocab-api.vercel.app/api/words';
var levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
function fetchWordsByLevel(level) {
    return __awaiter(this, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(JLPT_API, "?level=").concat(level.substring(1)))];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error("JLPT API error L".concat(level));
                    return [4 /*yield*/, res.json()];
                case 2: return [2 /*return*/, (_a.sent())];
            }
        });
    });
}
function fetchAll() {
    return __awaiter(this, void 0, void 0, function () {
        var allLists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.all(levels.map(fetchWordsByLevel))];
                case 1:
                    allLists = _a.sent();
                    return [2 /*return*/, allLists.flat()];
            }
        });
    });
}
//--------------------------------------------------
// 2. Jisho API 래퍼
//--------------------------------------------------
function jishoLookup(word) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, json;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    url = "https://jisho.org/api/v1/search/words?keyword=".concat(encodeURIComponent(word));
                    return [4 /*yield*/, fetch(url)];
                case 1:
                    res = _c.sent();
                    if (!res.ok)
                        throw new Error("Jisho API error ".concat(word));
                    return [4 /*yield*/, res.json()];
                case 2:
                    json = _c.sent();
                    return [2 /*return*/, (_b = (_a = json.data) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null];
            }
        });
    });
}
//--------------------------------------------------
// 3. DeepL 번역 함수 (영 → 한)
//--------------------------------------------------
function translateKo(text) {
    return __awaiter(this, void 0, void 0, function () {
        var form, res, json, translated;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!text)
                        return [2 /*return*/, []];
                    form = new URLSearchParams({
                        text: text,
                        source_lang: 'EN',
                        target_lang: 'KO',
                    });
                    return [4 /*yield*/, fetch('https://api-free.deepl.com/v2/translate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                Authorization: "DeepL-Auth-Key ".concat(process_1.default.env.DEEPL_KEY),
                            },
                            body: form.toString(),
                        })];
                case 1:
                    res = _d.sent();
                    if (!res.ok)
                        throw new Error('DeepL API error');
                    return [4 /*yield*/, res.json()];
                case 2:
                    json = _d.sent();
                    translated = (_c = (_b = (_a = json.translations) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text) !== null && _c !== void 0 ? _c : '';
                    return [2 /*return*/, translated.split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean)];
            }
        });
    });
}
//--------------------------------------------------
// 4. 메인 merge 로직
//--------------------------------------------------
// const MAX_EXAMPLES = 3; // 예문 최대 수
function buildDataset() {
    return __awaiter(this, void 0, void 0, function () {
        var jlptWords;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.time('build');
                    return [4 /*yield*/, fetchAll()];
                case 1:
                    jlptWords = _a.sent();
                    console.log(jlptWords);
                    return [2 /*return*/];
            }
        });
    });
}
//--------------------------------------------------
// 6. 실행
//--------------------------------------------------
if (require.main === module) {
    buildDataset().catch(function (e) {
        console.error(e);
        process_1.default.exit(1);
    });
}
