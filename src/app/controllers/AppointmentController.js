import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt-BR';
import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';

import CancellationMail from '../jobs/CancellationMail';
import Queue from '../../lib/Queue';

class AppointmentControle {
  async index(req, res) {
    const { page } = req.query;
    const appointments = await Appointment.findAll({
      where: {
        user_id: req.userId,
        canceled_at: null,
      },
      limit: 20,
      offset: (page - 1) * 20,
      attributes: ['id', 'date', 'past', 'cancelable'],
      order: ['date'],
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['path', 'url'],
            },
          ],
        },
      ],
    });
    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });
    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails!' });
    }
    const { provider_id, date } = req.body;
    /**
     * Check if provider id a provider
     */
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });
    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'You can only create appointments with provider!' });
    }
    /**
     * Check for past dates
     */
    const hourStart = startOfHour(parseISO(date));
    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permitted !' });
    }
    /**
     * Check date availability
     */
    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });
    if (checkAvailability) {
      return res.status(400).json({ error: 'Date not Availability!' });
    }
    if (req.userId === provider_id) {
      return res
        .status(400)
        .json({ error: "you can't create a schedule with yourself" });
    }
    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });
    /**
     * Notify Appointment provider
     */
    const user = await User.findByPk(req.userId);
    const formatedDate = format(hourStart, "dd 'de' MMMM', ás' HH:mm'h'", {
      locale: pt,
    });
    Notification.create({
      content: `Novo agendamento com o ${user.name} para o dia ${formatedDate} `,
      user: provider_id,
    });

    return res.json({ appointment });
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });
    if (appointment.user_id !== req.userId) {
      return res.status(401).json({
        error: "You don't have permisson to cancel this appointment!",
      });
    }
    const dataWithSub = subHours(appointment.date, 2);

    if (isBefore(dataWithSub, new Date())) {
      return res.status(401).json({
        error: 'You can only cancel appointments 2 hours in advance.',
      });
    }
    appointment.canceled_at = new Date();
    await appointment.save();

    await Queue.add(CancellationMail.key, {
      appointment,
    });
    return res.json(appointment);
  }
}
export default new AppointmentControle();
