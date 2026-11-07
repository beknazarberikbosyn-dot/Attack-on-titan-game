// Свои спрайты титанов. Добавь строку — и игра возьмёт картинку вместо процедурного рисунка.
//   base   — основной кадр (вид спереди, прозрачный фон, ступни у нижнего края)
//   walk1, walk2, attack — необязательные отдельные кадры; если их нет, игра соберёт анимацию из base
//   legsFrom — где начинаются ноги (доля высоты сверху), нужно для автоанимации шага
// Типы: colossal, armored, female, beast, jaw, normal, small, deviant, eren
window.AOT_TITAN_SPRITES = {
  colossal: { base: 'colossal.png', legsFrom: 0.5 },
};
