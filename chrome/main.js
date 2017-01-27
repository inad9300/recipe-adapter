/**
 * Main program.
 */
(function () {
    setup_elem_picker()
    listen_and_propagate_input_changes()
})()

/**
 * Let the user pick an element and replace all the numbers on it with input boxes.
 */
function setup_elem_picker() {
    let last_hovered_elem
    let elem_was_selected = false

    on(document.body, 'mouseover', event => {
        last_hovered_elem = event.target

        if (!elem_was_selected) event.target.classList.add('ingredient-list-selector')
    })

    on(document.body, 'mouseout', event => remove_bg(event.target))

    on(document.body, 'click', event => {
        if (!elem_was_selected) {
            remove_bg(last_hovered_elem)
            replace_quantities_with_inputs(last_hovered_elem)
        }
        elem_was_selected = true
    })

    function remove_bg(elem) {
        elem.classList.remove('ingredient-list-selector')
    }
}

/**
 * Shortcut for listening events on HTML elements.
 */
function on(elem, event, fn) {
    elem.addEventListener(event, fn)
}

/**
 * Replace digits found withing the given element with input boxes.
 * 
 * FIXME: some numbers are not being properly replaced.
 */
function replace_quantities_with_inputs(elem) {
    replace_text(elem, /[1-9]\/[2-9]|\d+|¼|½|¾/g, (node, match) => {
        const numeric_value = get_numeric_value(match)

        const span = document.createElement('span')
        span.textContent = numeric_value
        span.setAttribute('class', 'ingredient-input')
        span.setAttribute('data-initial-value', numeric_value)
        span.setAttribute('contenteditable', 'true')

        node.parentNode.insertBefore(span, node.nextSibling)
    })

    function get_numeric_value(value) {
        if (value === '¼') return '1/4'
        else if (value === '½') return '1/2'
        else if (value === '¾') return '3/4'
        else return value
    }
}

/**
 * From http://blog.alexanderdickson.com/javascript-replacing-text
 */
function replace_text(node, regex, callback) {
    const node_type = {elem: 1, attr: 2, text: 3, comment: 8}
    const exclude_elems = ['script', 'style', 'iframe', 'canvas']

    let child = node.firstChild
   
    do {
        switch (child.nodeType) {
        case node_type.elem:
            if (exclude_elems.indexOf(child.tagName.toLowerCase()) > -1) continue

            replace_text(child, regex, callback)
            break

        case node_type.text:
           child.data.replace(regex, function (all) {
                const args = [].slice.call(arguments)
                const offset = args[args.length - 2]
                const next_text_node = child.splitText(offset)

                next_text_node.data = next_text_node.data.substr(all.length)
                callback.apply(window, [child].concat(args))
                child = next_text_node
            })
            break
        }
    } while (child = child.nextSibling)

    return node
}

/**
 * Listen to changes on the input boxes and propagate them proportionally.
 */
function listen_and_propagate_input_changes() {
    on(document.body, 'keyup', event => {
        if (!event.target.classList.contains('ingredient-input')) return

        const ingredient_inputs = document.getElementsByClassName('ingredient-input')

        const initial_value = parse_number(event.target.getAttribute('data-initial-value'))
        const current_value = parse_number(event.target.textContent)
        const ratio = current_value / initial_value

        for (let i = 0; i < ingredient_inputs.length; i++)
            if (ingredient_inputs[i] !== event.target)
                ingredient_inputs[i].textContent = get_new_value(ingredient_inputs[i])

        function parse_number(str) {
            if (/[1-9]\/[2-9]/.test(str)) {
                const [first_digit, second_digit] = str.split('/')
                return parseInt(first_digit) / parseInt(second_digit)
            }
            return parseInt(str.replace(/[^0-9\.]/g, ''))
        }

        function get_new_value(input) {
            const measuring_spoons = [{
                names: ['tablespoon', 'tablespoons', 'tbsp'],
                divisors: [2]
            }, {
                names: ['cup', 'cups'],
                divisors: [2, 3, 4]
            }, {
                names: ['teaspoon', 'teaspoon', 'tsp'],
                divisors: [2, 4, 6, 8]
            }]

            const initial_value = input.getAttribute('data-initial-value')
            const new_value = ratio * parse_number(initial_value)

            // For some units, if the value has decimals, it makes more sense to return a fraction.
            // TODO: if the original unit is a fraction... e.g. 1/2 a lemon.
            if (new_value % 1 !== 0) {
                const parent_text = input.parentNode.textContent

                spoons_loop:
                for (let i = 0; i < measuring_spoons.length; ++i) {
                    const spoon = measuring_spoons[i]

                    for (let j = 0; j < spoon.names.length; ++j)
                        if (parent_text.indexOf(' ' + spoon.names[j]) > -1) {
                            const fraction = '' + transform_number_to_fraction(new_value, spoon.divisors)
                            if (fraction.indexOf('/') > 0) return fraction
                            else break spoons_loop
                        }
                }
            }

            const new_value_fixed = new_value.toFixed(1)
            return new_value_fixed.endsWith('.0') ? new_value_fixed.slice(0, -2) : new_value_fixed
        }

        function transform_number_to_fraction(number, divisors) {
            // For every divisor, check dividends from 1 to the divisor minus one, and see if that produces the number.
            // TODO: find a better way to do this.
            for (let i = 0; i < divisors.length; ++i)
                for (let j = 1; j < divisors[i]; ++j)
                    if (j / divisors[i] === number) return j + '/' + divisors[i]

            return number
        }
    })
}
