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
 * Replace digits found within the given element with input boxes.
 */
function replace_quantities_with_inputs(elem) {
    const regex = /[1-9]\/[2-9]|\d+|¼|½|¾|half/g
    const walker = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT)

    while (walker.nextNode()) {
        let match
        while ((match = regex.exec(walker.currentNode.nodeValue))) {
            const value = get_numeric_value(match[0])

            const span = document.createElement('span')
            span.textContent = value
            span.setAttribute('class', 'ingredient-input')
            span.setAttribute('data-initial-value', value)
            span.setAttribute('contenteditable', 'true')

            const second_node = walker.currentNode.splitText(match.index)
            second_node.nodeValue = second_node.nodeValue.substr(match[0].length) // Remove the original matched string.
            walker.currentNode.parentNode.insertBefore(span, second_node)
            walker.nextNode() // Skip the newly created node.
        }
    }

    function get_numeric_value(value) {
        if (value === '¼') return '1/4'
        else if (value === '½' || value === 'half') return '1/2'
        else if (value === '¾') return '3/4'
        else return value
    }
}

/**
 * Listen to changes on the input boxes and propagate them proportionally.
 */
function listen_and_propagate_input_changes() {
    on(document.body, 'keyup', event => {
        if (!event.target.classList.contains('ingredient-input')) return

        const initial_value = parse_number(event.target.getAttribute('data-initial-value'))
        const current_value = parse_number(event.target.textContent)
        const ratio = current_value / initial_value

        const ingredient_inputs = document.getElementsByClassName('ingredient-input')

        for (let i = 0; i < ingredient_inputs.length; i++)
            if (ingredient_inputs[i] !== event.target)
                ingredient_inputs[i].textContent = get_new_value(ingredient_inputs[i], ratio)
    })

    function parse_number(str) {
        return /[1-9]\/[2-9]/.test(str)
            ? str_fraction_to_float(str)
            : parseFloat(str.replace(/[^0-9\.]/g, ''))
    }

    function str_fraction_to_float(str) {
        const [first_digit, second_digit] = str.split('/')
        return parseInt(first_digit) / parseInt(second_digit)
    }

    function get_new_value(input, ratio) {
        const initial_value = input.getAttribute('data-initial-value')
        const new_value = ratio * parse_number(initial_value)
        const new_value_has_decimals = new_value % 1 !== 0

        // If the original value was a fraction or the ingredient is expressed in certain units, we return a fraction.
        if (new_value_has_decimals && (contains_measuring_spoon(input.parentNode.textContent) || /[1-9]\/[2-9]/.test(initial_value))) {
            const fraction_or_number = get_fraction_or_number(new_value)
            if (/[1-9]\/[2-9]/.test(fraction_or_number)) return fraction_or_number
        }

        const new_value_fixed = new_value.toFixed(1)
        return new_value_fixed.endsWith('.0') ? new_value_fixed.slice(0, -2) : new_value_fixed
    }

    function contains_measuring_spoon(text) {
        const measuring_spoons = ['tablespoon', 'tablespoons', 'tbsp', 'cup', 'cups', 'teaspoon', 'teaspoon', 'tsp']

        for (let i = 0; i < measuring_spoons.length; ++i)
            if (text.indexOf(' ' + measuring_spoons[i]) > -1) return true
        
        return false
    }

    function get_fraction_or_number(number) {
        const sensible_fractions_str = [
            '1/2',
            '1/3', '2/3',
            '1/4', '2/4', '3/4',
            '1/5', '2/5', '3/5', '4/5',
            '1/6', '2/6', '3/6', '4/6', '5/6',
            '1/7', '2/7', '3/7', '4/7', '5/7', '6/7',
            '1/8', '2/8', '3/8', '4/8', '5/8', '6/8', '7/8',
            '1/9', '2/9', '3/9', '4/9', '5/9', '6/9', '7/9', '8/9',
            '1/10','2/10','3/10','4/10','5/10','6/10','7/10','8/10','9/10'
        ]
        const sensible_fractions_num = sensible_fractions_str.map(str_fraction_to_float)

        for (let i = 0; i < sensible_fractions_num.length; ++i)
            if (number === sensible_fractions_num[i]) return sensible_fractions_str[i]
        
        return number
    }
}
