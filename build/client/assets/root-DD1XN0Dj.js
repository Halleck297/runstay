import{j as t}from"./jsx-runtime-0DLF9kdB.js";import{g as f,h as y,i as g,j as x,r as a,_ as S,k as i,u as w,O as j,M,l as k,S as N}from"./components-Oo-HIKtb.js";/**
 * @remix-run/react v2.17.4
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */let l="positions";function O({getKey:e,...c}){let{isSpaMode:u}=f(),o=y(),h=g();x({getKey:e,storageKey:l});let m=a.useMemo(()=>{if(!e)return null;let s=e(o,h);return s!==o.key?s:null},[]);if(u)return null;let p=((s,d)=>{if(!window.history.state||!window.history.state.key){let r=Math.random().toString(32).slice(2);window.history.replaceState({key:r},"")}try{let n=JSON.parse(sessionStorage.getItem(s)||"{}")[d||window.history.state.key];typeof n=="number"&&window.scrollTo(0,n)}catch(r){console.error(r),sessionStorage.removeItem(s)}}).toString();return a.createElement("script",S({},c,{suppressHydrationWarning:!0,dangerouslySetInnerHTML:{__html:`(${p})(${i(JSON.stringify(l))}, ${i(JSON.stringify(m))})`}}))}const E=()=>[{rel:"preconnect",href:"https://fonts.googleapis.com"},{rel:"preconnect",href:"https://fonts.gstatic.com",crossOrigin:"anonymous"},{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap"}];function H({children:e}){return t.jsxs("html",{lang:"en",className:"h-full",children:[t.jsxs("head",{children:[t.jsx("meta",{charSet:"utf-8"}),t.jsx("meta",{name:"viewport",content:"width=device-width, initial-scale=1"}),t.jsx(M,{}),t.jsx(k,{})]}),t.jsxs("body",{className:"h-full bg-gray-50 font-sans text-gray-900 antialiased",children:[e,t.jsx(O,{}),t.jsx(N,{})]})]})}function I(){const{ENV:e}=w();return t.jsxs(t.Fragment,{children:[t.jsx("script",{dangerouslySetInnerHTML:{__html:`window.ENV = ${JSON.stringify(e)}`}}),t.jsx(j,{})]})}export{H as Layout,I as default,E as links};
