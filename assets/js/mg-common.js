$(document).ready(function() {

    /*
     * Back To Top Button
     */

    $('#back-top a').on("click", function(event) {
        event.preventDefault();
        $('html,body').stop().animate({
            scrollTop: 0
        }, 300);
    });
    $(window).on('scroll', function() {
        var scroll = $(window).scrollTop();
        if (scroll < 400) {
            $('#back-top').fadeOut(500);
        } else {
            $('#back-top').fadeIn(500);
        }
    });
    /*******************/
    $('.mg-home-product-sider').slick({
        infinite: true,
        arrows: true,
        slidesToShow: 2,
        slidesToScroll: 1,
        appendArrows: ('.mg-home-product-slider-arrow'),
        prevArrow: '<button type="button" class="slick-prev"><img src="assets/images/home/icons/slider-left-arrow.png"></button>',
        nextArrow: '<button type="button" class="slick-next"><img src="assets/images/home/icons/slider-right-arrow.png"></button>'

    });
    $('.responsive').slick({
        dots: true,
        infinite: false,
        speed: 300,
        slidesToShow: 4,
        slidesToScroll: 4,
        responsive: [{
                breakpoint: 1024,
                settings: {
                    slidesToShow: 3,
                    slidesToScroll: 3,
                    infinite: true,
                    dots: true
                }
            },
            {
                breakpoint: 600,
                settings: {
                    slidesToShow: 2,
                    slidesToScroll: 2,
                }
            },
            {
                breakpoint: 480,
                settings: {
                    slidesToShow: 1,
                    slidesToScroll: 1
                }
            }
            // You can unslick at a given breakpoint now by adding:
            // settings: "unslick"
            // instead of a settings object
        ]
    });
    $('.mg-testimonial-inner').slick({
        infinite: true,
        arrows: true,
        slidesToShow: 1,
        slidesToScroll: 1,
        appendArrows: ('.mg-testimonial-arrow'),
        prevArrow: '<button type="button" class="slick-prev"><img src="assets/images/about/icons/left-arrow-light.png"></button>',
        nextArrow: '<button type="button" class="slick-next"><img src="assets/images/about/icons/right-arrow-light.png"></button>'

    });
    $('.mg-wishlist-btn').on('click', function(e) {
        e.preventDefault();
        $(this).find('.mg-w-icon').toggleClass('mg-light-heart');
        $(this).find('.mg-w-icon').toggleClass('mg-red-heart');
    });
    /*
     * product remove btn
     */
    $('.mg-product-remove-btn').click(function(e) {
        e.preventDefault();
        $(this).parents("tr").fadeOut('slow', function() {
            $(this).parents("tr").remove();
        });
    });


});