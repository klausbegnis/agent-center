import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findMarkupProblems, isAllowedAttribute, isAllowedElement } from './sprite-markup.js'

const sheet = (body) => `<svg xmlns="http://www.w3.org/2000/svg"><defs>${body}</defs></svg>`

test('plain drawing passes, gradients and references inside the sheet included', () => {
  const markup = sheet(
    '<radialGradient id="mt-glow"><stop offset="0" stop-color="#fff"/></radialGradient>' +
      '<symbol id="mt-idle" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" ' +
      'fill="url(#mt-glow)"/><use href="#mt-eyes"/></symbol>'
  )
  assert.deepEqual(findMarkupProblems(markup), [])
})

test('comments are not read as markup', () => {
  assert.deepEqual(findMarkupProblems(sheet('<!-- an <image> would go here -->')), [])
})

test('elements that run code, load files or take input are refused', () => {
  for (const name of ['script', 'foreignObject', 'image', 'style', 'a', 'form', 'iframe', 'animate', 'set']) {
    assert.equal(isAllowedElement(name), false, name)
  }
  assert.equal(findMarkupProblems(sheet('<image href="#mt-x"/>')).length, 1)
})

test('event handlers and inline styles are refused', () => {
  assert.equal(isAllowedAttribute('onload', 'x()'), false)
  assert.equal(isAllowedAttribute('style', 'fill: red'), false)
  assert.equal(isAllowedAttribute('formaction', 'javascript:x()'), false)
})

test('a link may only point inside the sheet', () => {
  assert.equal(isAllowedAttribute('href', '#mt-idle'), true)
  assert.equal(isAllowedAttribute('xlink:href', ' #mt-idle'), true)
  assert.equal(isAllowedAttribute('href', 'https://example.com/a.svg#x'), false)
  assert.equal(isAllowedAttribute('href', 'javascript:x()'), false)
})

test('a paint value may not load anything from outside the sheet', () => {
  assert.equal(isAllowedAttribute('fill', "url('#mt-glow')"), true)
  assert.equal(isAllowedAttribute('fill', 'url(https://example.com/p.svg#x)'), false)
  assert.equal(isAllowedAttribute('mask', 'url( data:image/svg+xml,x)'), false)
})

test('every problem in a sheet is listed', () => {
  const problems = findMarkupProblems(sheet('<rect onclick="x()" style="a"/><script>x()</script>'))
  assert.equal(problems.length, 3)
})

test('entity declarations are refused, since they could hide markup from this check', () => {
  const markup = '<!DOCTYPE svg [<!ENTITY e "<script>x()</script>">]><svg>&e;</svg>'
  assert.ok(findMarkupProblems(markup).some((problem) => problem.includes('entity')))
})
